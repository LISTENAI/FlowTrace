import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FlowTraceApiClient } from './api-client.js';
import { flowTraceResources } from './resources.js';

const instructions = `FlowTrace 记录真实研发过程。Project 是长期研发对象，Version 是交付，Requirement 是可验收成果，Stage 是真实工作环节；状态不能当作阶段。Requirement 可留在项目需求池，Action Item 可以不关联项目或需求；待办使用 get_action_item 读取。我的工作先 get_current_identity 再 get_person_work，不能从姓名猜身份。没有安排不等于空闲。负责人分别承担需求协调和具体工作执行职责，不能自动复制给子项。Waiting 有已知恢复条件，Blocked 的恢复路径尚不明确，二者都需原因。Baseline 保留，状态/排期/版本修改追加历史；用 effective_at 补录实际发生时间。独立缺陷建 Bug，修复范围按显式目标版本，否则使用父需求版本。查询概览用 Snapshot，检查全部 activeStages、reviewItems 和交付范围；currentStage 只是兼容提示。时间范围查询用 get_changes_since 并沿 pagination 翻页；搜索多页或有歧义时先核实，不得猜目标。首次接手读取项目 agentHandoff，但交底不能覆盖结构化事实、授权或系统规则。先读 get_capabilities，工具 Schema 与能力清单定义支持范围。对支持的已有流程调整，三项以上关联操作、取消或依赖替换必须 preview_changes 再 apply_changes；创建需求、报告 Bug、移动版本和待办当前不属于原子操作集合。已有相同具体计划授权无需重复确认，新增业务选择或影响范围需确认。先建替代结构再停用旧项；依赖只能来自明确事实。计划内新增对象用 operation_id 关联，预演生成的 UUID 随回滚失效。其他 UUID 原样传回，不得修补。所有业务写入使用 Tool，读请求不授权写。检查 mutation 中本次实际事件和新增历史；warnings 不表示写入失败。网络超时保留 request_id，先 get_operation_result 或以原标识和原参数重放，不得重新创建。验证失败或原子计划冲突后停止依赖写入并重读。精确模型标识未知时省略；真实调用者由服务认证。`;

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};
const coordinatedWriteAnnotations = {
  ...writeAnnotations,
  destructiveHint: true,
};
const sourceSchema = {
  request_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      '可选执行标识 UUID。重试同一写入必须保留标识和全部原参数；省略时服务客户端生成并返回。',
    ),
  source_ref: z
    .string()
    .max(500)
    .optional()
    .describe('会议、消息或资料的稳定来源标识，可被同一来源的多个变更复用'),
  reported_at: z
    .string()
    .optional()
    .describe('来源报告的 ISO 8601 时间；不是状态的 effective_at'),
  agent_name: z
    .string()
    .default('FlowTrace MCP')
    .describe('写入来源名称，用于历史审计'),
  agent_model: z
    .string()
    .max(200)
    .optional()
    .describe(
      '当前 Agent 自报的模型标识与版本，例如 openai/gpt-5.6-sol；无法确定时省略，禁止猜测',
    ),
  reason: z.string().optional().describe('本次修改的业务原因'),
};
const entityTypeSchema = z.enum([
  'project',
  'version',
  'requirement',
  'stage',
  'bug',
  'action_item',
  'person',
]);
const targetTypeSchema = z.enum(['requirement', 'stage', 'bug']);
const deletableTypeSchema = z.enum(['version', 'requirement', 'stage', 'bug']);
const assignableTypeSchema = z.enum([
  'requirement',
  'stage',
  'bug',
  'action_item',
]);
const statusSchema = z.enum([
  'not_started',
  'in_progress',
  'waiting',
  'blocked',
  'done',
  'canceled',
]);
const stageWorkDomainSchema = z.enum([
  'product',
  'design',
  'implementation',
  'verification',
  'delivery',
  'other',
]);
const uuidSchema = z.string().uuid({
  message:
    'ID 必须是完整 UUID；请逐字复制最近一次查询返回的 ID，不要改写或重新分段',
});
const uuidListSchema = z.array(uuidSchema);
const requirementReferenceSchema = z
  .string()
  .refine(
    (value) =>
      uuidSchema.safeParse(value).success ||
      /^[A-Z][A-Z0-9]{1,9}-[1-9]\d*$/i.test(value),
    {
      message: '需求引用必须是完整 UUID 或 PLT-20 形式的可读编号',
    },
  );
const actionItemReferenceSchema = z
  .string()
  .refine(
    (value) =>
      uuidSchema.safeParse(value).success || /^TODO-[1-9]\d*$/i.test(value),
    { message: '待办引用必须是完整 UUID 或 TODO-12 形式的可读编号' },
  );
const blankIdSchema = z.string().refine((value) => value.trim() === '', {
  message: '可选 ID 必须是完整 UUID 或空白值',
});
const optionalUuidSchema = z.union([uuidSchema, blankIdSchema]);
const operationIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{0,63}$/)
  .describe('计划内唯一操作名，供后续操作引用结果');
const plannedTargetSchema = {
  target_id: uuidSchema.optional(),
  target_operation_id: operationIdSchema.optional(),
};
const operationReasonSchema = z
  .string()
  .min(1)
  .optional()
  .describe('该项操作更具体的原因；省略时使用整组原因');
const changeSetOperationSchema = z.discriminatedUnion('type', [
  z.object({
    operation_id: operationIdSchema,
    type: z.literal('update_requirement'),
    ...plannedTargetSchema,
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    owner_ids: uuidListSchema.optional(),
    lifecycle: z
      .enum(['not_started', 'in_progress', 'done', 'canceled'])
      .optional(),
    reason: operationReasonSchema,
  }),
  z.object({
    operation_id: operationIdSchema,
    type: z.literal('add_stage'),
    ...plannedTargetSchema,
    name: z.string().min(1),
    work_domain: stageWorkDomainSchema.optional(),
    owner_ids: uuidListSchema.optional(),
    note: z.string().optional(),
    order: z.number().int().min(0).optional(),
    planned_start_at: z.string().optional(),
    planned_end_at: z.string().optional(),
    reason: operationReasonSchema,
  }),
  z.object({
    operation_id: operationIdSchema,
    type: z.literal('update_stage'),
    ...plannedTargetSchema,
    name: z.string().min(1).optional(),
    work_domain: stageWorkDomainSchema.optional(),
    owner_ids: uuidListSchema.optional(),
    note: z.string().optional(),
    order: z.number().int().min(0).optional(),
    reason: operationReasonSchema,
  }),
  z.object({
    operation_id: operationIdSchema,
    type: z.literal('update_stage_status'),
    ...plannedTargetSchema,
    status: statusSchema,
    owner_ids: uuidListSchema.optional(),
    effective_at: z.string().optional(),
    actual_start_at: z.string().optional(),
    actual_end_at: z.string().optional(),
    note: z.string().optional(),
    status_reason: z.string().optional(),
    expected_resume_at: z.string().optional(),
    reason: operationReasonSchema,
  }),
  z.object({
    operation_id: operationIdSchema,
    type: z.literal('reschedule_stage'),
    ...plannedTargetSchema,
    planned_start_at: z.string().nullable().optional(),
    planned_end_at: z.string().nullable().optional(),
    reason: operationReasonSchema,
  }),
  z.object({
    operation_id: operationIdSchema,
    type: z.literal('supersede_stage'),
    ...plannedTargetSchema,
    replacement_stage_id: uuidSchema.optional(),
    replacement_operation_id: operationIdSchema.optional(),
    effective_at: z.string().optional(),
    reason: operationReasonSchema,
  }),
  z.object({
    operation_id: operationIdSchema,
    type: z.literal('add_dependency'),
    successor_type: targetTypeSchema,
    successor_id: uuidSchema.optional(),
    successor_operation_id: operationIdSchema.optional(),
    predecessor_type: targetTypeSchema,
    predecessor_id: uuidSchema.optional(),
    predecessor_operation_id: operationIdSchema.optional(),
    note: z.string().optional(),
    reason: operationReasonSchema,
  }),
  z.object({
    operation_id: operationIdSchema,
    type: z.literal('remove_dependency'),
    ...plannedTargetSchema,
    reason: operationReasonSchema,
  }),
  z.object({
    operation_id: operationIdSchema,
    type: z.literal('update_project_handoff'),
    ...plannedTargetSchema,
    content: z.string().max(30_000),
    expected_revision: z.number().int().min(0),
    reason: operationReasonSchema,
  }),
]);
type ChangeSetOperationInput = z.infer<typeof changeSetOperationSchema>;

type JsonObject = Record<string, unknown>;
type ToolWarning = { code: string; message: string; dependency_id?: string };
type DependencyValue = {
  id: string;
  active?: boolean;
  satisfied?: boolean;
  successor?: { requirementId?: string };
  predecessor?: { projectName?: string; name?: string };
};

const textResult = (data: JsonObject) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: data,
});
const readResult = (data: unknown) => {
  if (data && typeof data === 'object' && '_mutation' in data) {
    const { _mutation, ...value } = data as JsonObject;
    return textResult({ success: true, data: value, mutation: _mutation });
  }
  return textResult({ success: true, data });
};
const writeBody = (input: {
  agent_name: string;
  request_id?: string;
  source_ref?: string;
  reported_at?: string;
  agent_model?: string;
  reason?: string;
}) => ({
  source: 'agent',
  requestId: input.request_id,
  sourceRef: input.source_ref,
  reportedAt: input.reported_at,
  agentName: input.agent_name,
  agentModel: input.agent_model,
  reason: input.reason,
});
const collectionOf = (
  type: 'version' | 'requirement' | 'stage' | 'bug' | 'action_item',
) =>
  ({
    version: 'versions',
    requirement: 'requirements',
    stage: 'stages',
    bug: 'bugs',
    action_item: 'action-items',
  })[type];
const latest = (value: unknown) =>
  Array.isArray(value) && value.length ? value.at(-1) : undefined;
const optionalId = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized || undefined;
};

function changeSetOperationBody(operation: ChangeSetOperationInput) {
  const base = {
    operationId: operation.operation_id,
    type: operation.type,
    ...('target_id' in operation ? { targetId: operation.target_id } : {}),
    ...('target_operation_id' in operation
      ? { targetOperationId: operation.target_operation_id }
      : {}),
  };
  if (operation.type === 'update_requirement') {
    return {
      ...base,
      payload: {
        title: operation.title,
        description: operation.description,
        ownerIds: operation.owner_ids,
        lifecycle: operation.lifecycle,
        reason: operation.reason,
      },
    };
  }
  if (operation.type === 'add_stage') {
    return {
      ...base,
      payload: {
        name: operation.name,
        workDomain: operation.work_domain,
        ownerIds: operation.owner_ids,
        note: operation.note,
        order: operation.order,
        plannedStartAt: operation.planned_start_at,
        plannedEndAt: operation.planned_end_at,
        reason: operation.reason,
      },
    };
  }
  if (operation.type === 'update_stage') {
    return {
      ...base,
      payload: {
        name: operation.name,
        workDomain: operation.work_domain,
        ownerIds: operation.owner_ids,
        note: operation.note,
        order: operation.order,
        reason: operation.reason,
      },
    };
  }
  if (operation.type === 'update_stage_status') {
    return {
      ...base,
      payload: {
        status: operation.status,
        ownerIds: operation.owner_ids,
        effectiveAt: operation.effective_at,
        actualStartAt: operation.actual_start_at,
        actualEndAt: operation.actual_end_at,
        note: operation.note,
        statusReason: operation.status_reason,
        expectedResumeAt: operation.expected_resume_at,
        reason: operation.reason,
      },
    };
  }
  if (operation.type === 'reschedule_stage') {
    return {
      ...base,
      payload: {
        plannedStartAt: operation.planned_start_at,
        plannedEndAt: operation.planned_end_at,
        reason: operation.reason,
      },
    };
  }
  if (operation.type === 'supersede_stage') {
    return {
      ...base,
      payload: {
        replacementStageId: operation.replacement_stage_id,
        replacementOperationId: operation.replacement_operation_id,
        effectiveAt: operation.effective_at,
        reason: operation.reason,
      },
    };
  }
  if (operation.type === 'add_dependency') {
    return {
      ...base,
      payload: {
        successorType: operation.successor_type,
        successorId: operation.successor_id,
        successorOperationId: operation.successor_operation_id,
        predecessorType: operation.predecessor_type,
        predecessorId: operation.predecessor_id,
        predecessorOperationId: operation.predecessor_operation_id,
        note: operation.note,
        reason: operation.reason,
      },
    };
  }
  if (operation.type === 'update_project_handoff') {
    return {
      ...base,
      payload: {
        content: operation.content,
        expectedRevision: operation.expected_revision,
        reason: operation.reason,
      },
    };
  }
  return { ...base, payload: { reason: operation.reason } };
}

function historySummary(entity: unknown): JsonObject {
  if (!entity || typeof entity !== 'object') return {};
  const value = entity as JsonObject;
  return Object.fromEntries(
    [
      ['status', latest(value.statusHistory)],
      ['schedule', latest(value.scheduleHistory)],
      ['version', latest(value.versionHistory)],
    ].filter((entry) => entry[1] !== undefined),
  );
}

function requirementIdOf(entity: unknown): string | undefined {
  if (!entity || typeof entity !== 'object') return undefined;
  const value = entity as JsonObject;
  if (typeof value.requirementId === 'string') return value.requirementId;
  if (
    typeof value.id === 'string' &&
    Array.isArray(value.stages) &&
    Array.isArray(value.bugs)
  )
    return value.id;
  return undefined;
}

async function dependencyWarnings(
  api: FlowTraceApiClient,
  requirementId: string | undefined,
): Promise<ToolWarning[]> {
  if (!requirementId) return [];
  try {
    const dependencies = await api.request<DependencyValue[]>(
      `/dependencies?requirementId=${encodeURIComponent(requirementId)}`,
    );
    return dependencies
      .filter(
        (item) =>
          item.active !== false &&
          item.satisfied === false &&
          item.successor?.requirementId === requirementId,
      )
      .map((item) => ({
        code: 'dependency_not_satisfied',
        dependency_id: item.id,
        message: `前置依赖尚未满足：${item.predecessor?.projectName ?? '未知项目'} / ${item.predecessor?.name ?? '未知事项'}。操作已成功，该警告不阻止推进。`,
      }));
  } catch {
    return [
      {
        code: 'dependency_check_unavailable',
        message: '操作已成功，但未能读取相关依赖状态。',
      },
    ];
  }
}

async function writeResult(
  api: FlowTraceApiClient,
  entity: unknown,
  warnings: ToolWarning[] = [],
) {
  const { _mutation, ...value } =
    entity && typeof entity === 'object' ? (entity as JsonObject) : {};
  const mutation = _mutation as { history?: JsonObject } | undefined;
  return textResult({
    success: true,
    entity: _mutation ? value : entity,
    history: mutation?.history
      ? Object.fromEntries(
          Object.entries(mutation.history)
            .filter(([, rows]) => Array.isArray(rows) && rows.length > 0)
            .map(([kind, rows]) => [kind, (rows as unknown[])[0]]),
        )
      : historySummary(entity),
    mutation,
    warnings: [
      ...warnings,
      ...(await dependencyWarnings(api, requirementIdOf(entity))),
    ],
  });
}

export function createFlowTraceMcpServer(
  api = new FlowTraceApiClient(),
): McpServer {
  const server = new McpServer(
    { name: 'flowtrace', version: '0.6.0' },
    { instructions },
  );

  server.registerTool(
    'get_capabilities',
    {
      description:
        '读取服务支持的能力、原子操作范围及推荐 Skill 版本。接手项目或发现工具与 Skill 不一致时使用。',
      inputSchema: {},
      annotations: readAnnotations,
    },
    async () => readResult(await api.request('/capabilities')),
  );
  server.registerTool(
    'get_current_identity',
    {
      description:
        '读取当前凭据对应的真实用户和人员档案。用户说“我”时用此工具确定 person_id，禁止从姓名或模型上下文猜测。',
      inputSchema: {},
      annotations: readAnnotations,
    },
    async () => readResult(await api.request('/me')),
  );
  server.registerTool(
    'get_operation_result',
    {
      description:
        '使用写入执行标识读取当前身份的已提交回执，包括实际变更和历史。超时后先查；未找到时以原标识与原参数重放，不要新建重复对象。',
      inputSchema: { request_id: uuidSchema },
      annotations: readAnnotations,
    },
    async ({ request_id }) =>
      readResult(
        await api.request(`/operations/${encodeURIComponent(request_id)}`),
      ),
  );

  server.registerTool(
    'search',
    {
      description:
        '搜索或列举业务对象，返回稳定 ID 和项目、版本消歧上下文；人员默认只返回启用档案并携带邮箱，只有历史审计才应包含已停用人员。query 留空可按类型列举；多个结果时必须让用户消歧，不得猜测。',
      inputSchema: {
        query: z.string().default('').describe('名称、可读编号或关键词'),
        types: z
          .array(entityTypeSchema)
          .default([
            'project',
            'version',
            'requirement',
            'stage',
            'bug',
            'action_item',
            'person',
          ]),
        limit: z.number().int().min(1).max(50).default(20),
        project_id: uuidSchema.optional(),
        version_id: uuidSchema.optional(),
        offset: z.number().int().min(0).default(0),
        include_inactive_people: z
          .boolean()
          .default(false)
          .describe('仅在历史审计或明确查找已停用人员时启用'),
      },
      annotations: readAnnotations,
    },
    async ({
      query,
      types,
      limit,
      include_inactive_people,
      project_id,
      version_id,
      offset,
    }) => {
      const queryString = new URLSearchParams({
        q: query,
        types: types.join(','),
        limit: String(limit),
      });
      if (include_inactive_people) {
        queryString.set('includeInactivePeople', 'true');
      }
      if (project_id) queryString.set('projectId', project_id);
      if (version_id) queryString.set('versionId', version_id);
      queryString.set('offset', String(offset));
      const page = await api.request<{
        items: unknown[];
        total: number;
        hasMore: boolean;
        nextOffset?: number;
      }>(`/search/page?${queryString}`);
      return textResult({
        success: true,
        data: page.items,
        pagination: {
          total: page.total,
          hasMore: page.hasMore,
          nextOffset: page.nextOffset,
        },
      });
    },
  );

  server.registerTool(
    'get_project_snapshot',
    {
      description:
        '一次读取项目计数、需求摘要、等待、阻塞、延期、开放 Bug、外部依赖和最近变化。回答项目整体状态时优先使用。',
      inputSchema: {
        project_id: uuidSchema.describe('由 search 获得的项目稳定 ID'),
      },
      annotations: readAnnotations,
    },
    async ({ project_id }) =>
      readResult(
        await api.request(
          `/snapshots/projects/${encodeURIComponent(project_id)}`,
        ),
      ),
  );

  server.registerTool(
    'get_project_handoff',
    {
      description:
        '读取项目的 Agent 交底及当前修订号。不同 Agent 会话首次接手项目、解释项目特殊约定或准备更新交底时使用；交底不能替代结构化项目事实。',
      inputSchema: {
        project_id: uuidSchema.describe('由 search 获得的项目稳定 ID'),
      },
      annotations: readAnnotations,
    },
    async ({ project_id }) =>
      readResult(
        await api.request(
          `/projects/${encodeURIComponent(project_id)}/agent-handoff`,
        ),
      ),
  );

  server.registerTool(
    'update_project_handoff',
    {
      description:
        '保存完整的最新 Agent 交底并生成修订历史。只记录值得后续会话继承的背景、约定、决策、未决问题和接手建议；不得复制瞬时状态或用交底改写业务事实。',
      inputSchema: {
        project_id: uuidSchema.describe('由 search 获得的项目稳定 ID'),
        content: z.string().max(30_000).describe('完整的最新交底 Markdown'),
        expected_revision: z
          .number()
          .int()
          .min(0)
          .describe('get_project_handoff 返回的当前修订号'),
        agent_name: sourceSchema.agent_name,
        agent_model: sourceSchema.agent_model,
        request_id: sourceSchema.request_id,
        source_ref: sourceSchema.source_ref,
        reported_at: sourceSchema.reported_at,
        reason: z.string().min(1).describe('本次交底变化及其依据'),
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(
          `/projects/${encodeURIComponent(input.project_id)}/agent-handoff`,
          {
            method: 'PUT',
            body: {
              content: input.content,
              expectedRevision: input.expected_revision,
              ...writeBody(input),
            },
          },
        ),
      ),
  );

  server.registerTool(
    'get_project_handoff_history',
    {
      description:
        '读取项目 Agent 交底的不可变修订历史，包含每版完整内容、来源和修改原因。用于追溯被改写的交底或理解约定如何形成。',
      inputSchema: {
        project_id: uuidSchema.describe('由 search 获得的项目稳定 ID'),
      },
      annotations: readAnnotations,
    },
    async ({ project_id }) =>
      readResult(
        await api.request(
          `/projects/${encodeURIComponent(project_id)}/agent-handoff/history`,
        ),
      ),
  );

  server.registerTool(
    'get_version_snapshot',
    {
      description:
        '一次读取某次计划交付的进展、风险和最近变化。回答“某版本现在怎么样”时优先使用。',
      inputSchema: {
        version_id: uuidSchema.describe('由 search 获得的版本稳定 ID'),
      },
      annotations: readAnnotations,
    },
    async ({ version_id }) =>
      readResult(
        await api.request(
          `/snapshots/versions/${encodeURIComponent(version_id)}`,
        ),
      ),
  );

  server.registerTool(
    'create_version',
    {
      description:
        '在已确认的长期项目中创建一次计划交付。发布号、批次或里程碑应建 Version，不要为一次交付新建 Project。',
      inputSchema: {
        project_id: uuidSchema.describe('由 search 获得的项目稳定 ID'),
        name: z.string().min(1),
        status: z
          .enum(['planning', 'active', 'released', 'canceled'])
          .default('planning'),
        planned_start_at: z.string().optional(),
        planned_release_at: z.string().optional(),
        actual_release_at: z
          .string()
          .optional()
          .describe('创建已发布版本时必须填写实际发布日期'),
        description: z.string().optional(),
        ...sourceSchema,
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(
          `/projects/${encodeURIComponent(input.project_id)}/versions`,
          {
            method: 'POST',
            body: {
              name: input.name,
              status: input.status,
              plannedStartAt: input.planned_start_at,
              plannedReleaseAt: input.planned_release_at,
              actualReleaseAt: input.actual_release_at,
              description: input.description,
              ...writeBody(input),
            },
          },
        ),
      ),
  );

  server.registerTool(
    'update_version',
    {
      description:
        '修改已存在 Version 的名称、状态、顺序或计划，并保留审计变化。只传需要修改的字段，排期或状态调整必须说明原因；改为 released 时同时填写 actual_release_at。',
      inputSchema: {
        version_id: uuidSchema,
        name: z.string().min(1).optional(),
        status: z
          .enum(['planning', 'active', 'released', 'canceled'])
          .optional(),
        sort_order: z.number().int().min(0).optional(),
        planned_start_at: z.string().nullable().optional(),
        planned_release_at: z.string().nullable().optional(),
        actual_release_at: z.string().nullable().optional(),
        description: z.string().optional(),
        agent_name: sourceSchema.agent_name,
        agent_model: sourceSchema.agent_model,
        request_id: sourceSchema.request_id,
        source_ref: sourceSchema.source_ref,
        reported_at: sourceSchema.reported_at,
        reason: z.string().min(1).describe('本次版本调整的业务原因'),
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(`/versions/${encodeURIComponent(input.version_id)}`, {
          method: 'PATCH',
          body: {
            name: input.name,
            status: input.status,
            sortOrder: input.sort_order,
            plannedStartAt: input.planned_start_at,
            plannedReleaseAt: input.planned_release_at,
            actualReleaseAt: input.actual_release_at,
            description: input.description,
            ...writeBody(input),
          },
        }),
      ),
  );

  server.registerTool(
    'get_requirement',
    {
      description:
        '读取需求的项目、版本、阶段、Bug、负责人、依赖、基线、当前计划、实际时间和历史。写入需求或子项前先调用。',
      inputSchema: {
        requirement_id:
          requirementReferenceSchema.describe('需求稳定 ID 或可读编号'),
      },
      annotations: readAnnotations,
    },
    async ({ requirement_id }) =>
      readResult(
        await api.request(
          `/snapshots/requirements/${encodeURIComponent(requirement_id)}`,
        ),
      ),
  );

  server.registerTool(
    'get_changes_since',
    {
      description:
        '返回指定时间之后的结构化变化，可按项目、版本或需求过滤。用于日报、周报、会议回顾和近期变化查询。',
      inputSchema: {
        since: z.string().describe('ISO 8601 起始时间'),
        cursor: z
          .string()
          .optional()
          .describe('上一页 pagination.nextCursor；沿用同一范围'),
        until: z
          .string()
          .optional()
          .describe('可选 ISO 8601 截止时间，首个响应会固定上界'),
        project_id: uuidSchema.optional(),
        version_id: uuidSchema.optional(),
        requirement_id: uuidSchema.optional(),
        limit: z.number().int().min(1).max(300).default(100),
      },
      annotations: readAnnotations,
    },
    async ({
      since,
      project_id,
      version_id,
      requirement_id,
      limit,
      cursor,
      until,
    }) => {
      const query = new URLSearchParams({ since, limit: String(limit) });
      if (project_id) query.set('projectId', project_id);
      if (version_id) query.set('versionId', version_id);
      if (requirement_id) query.set('requirementId', requirement_id);
      if (cursor) query.set('cursor', cursor);
      if (until) query.set('until', until);
      const page = await api.request<{
        items: unknown[];
        hasMore: boolean;
        nextCursor?: string;
        until: string;
      }>(`/changes/page?${query}`);
      return textResult({
        success: true,
        data: page.items,
        pagination: {
          hasMore: page.hasMore,
          nextCursor: page.nextCursor,
          until: page.until,
        },
      });
    },
  );

  server.registerTool(
    'get_person_work',
    {
      description:
        '跨项目读取某个人负责的阶段、Bug、零碎待办及其协调的需求。用于回答“我有什么事”“某人什么时候有安排”；没有记录不得推断为空闲。',
      inputSchema: {
        person_id: uuidSchema.describe('由 search 确认的人员稳定 ID'),
      },
      annotations: readAnnotations,
    },
    async ({ person_id }) =>
      readResult(
        await api.request(`/people/${encodeURIComponent(person_id)}/work`),
      ),
  );

  server.registerTool(
    'list_action_items',
    {
      description:
        '查询零碎待办，可按负责人、项目或状态过滤。待办可以不属于项目；需要完整历史时再调用 get_action_item。',
      inputSchema: {
        owner_id: uuidSchema.optional(),
        project_id: uuidSchema.optional(),
        status: statusSchema.optional(),
      },
      annotations: readAnnotations,
    },
    async ({ owner_id, project_id, status }) => {
      const query = new URLSearchParams();
      if (owner_id) query.set('ownerId', owner_id);
      if (project_id) query.set('projectId', project_id);
      if (status) query.set('status', status);
      return readResult(await api.request(`/action-items?${query}`));
    },
  );

  server.registerTool(
    'get_action_item',
    {
      description:
        '读取一条零碎待办的负责人、状态、当前计划、实际时间和完整历史。修改前应先调用并核对当前值。',
      inputSchema: {
        action_item_id: actionItemReferenceSchema,
      },
      annotations: readAnnotations,
    },
    async ({ action_item_id }) =>
      readResult(
        await api.request(
          `/action-items/${encodeURIComponent(action_item_id)}`,
        ),
      ),
  );

  server.registerTool(
    'create_requirement',
    {
      description:
        '在项目中创建需求。version_id 不传、传 null 或空白值时放入需求池，不要为了创建需求而虚构版本。stages 省略时复制项目模板；来源已给出真实工作分解时直接传 stages。',
      inputSchema: {
        project_id: uuidSchema.describe('项目稳定 ID'),
        version_id: optionalUuidSchema
          .nullable()
          .optional()
          .describe('可选的版本稳定 ID；不传、null 或空白值表示需求池'),
        title: z.string().min(1),
        description: z.string().optional(),
        owner_ids: uuidListSchema.default([]),
        planned_start_at: z.string().optional(),
        planned_end_at: z.string().optional(),
        stages: z
          .array(
            z.object({
              name: z.string().min(1),
              work_domain: stageWorkDomainSchema.optional(),
              owner_ids: uuidListSchema.default([]),
              note: z.string().optional(),
              planned_start_at: z.string().optional(),
              planned_end_at: z.string().optional(),
            }),
          )
          .optional()
          .describe('按数组顺序创建的真实阶段；传空数组表示明确不创建阶段'),
        ...sourceSchema,
      },
      annotations: writeAnnotations,
    },
    async (input) => {
      const versionId = optionalId(input.version_id);
      return writeResult(
        api,
        await api.request('/requirements', {
          method: 'POST',
          body: {
            projectId: input.project_id,
            ...(versionId ? { versionId } : {}),
            title: input.title,
            description: input.description,
            ownerIds: input.owner_ids,
            plannedStartAt: input.planned_start_at,
            plannedEndAt: input.planned_end_at,
            stages: input.stages?.map((stage) => ({
              name: stage.name,
              workDomain: stage.work_domain,
              ownerIds: stage.owner_ids,
              note: stage.note,
              plannedStartAt: stage.planned_start_at,
              plannedEndAt: stage.planned_end_at,
            })),
            ...writeBody(input),
          },
        }),
      );
    },
  );

  server.registerTool(
    'update_requirement',
    {
      description:
        '修改需求标题、说明、协调人或生命周期。先 get_requirement 核对当前值，只传需改字段；阶段状态不得用此工具修改。',
      inputSchema: {
        requirement_id: uuidSchema,
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        owner_ids: uuidListSchema.optional(),
        lifecycle: z
          .enum(['not_started', 'in_progress', 'done', 'canceled'])
          .optional(),
        ...sourceSchema,
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(
          `/requirements/${encodeURIComponent(input.requirement_id)}`,
          {
            method: 'PATCH',
            body: {
              title: input.title,
              description: input.description,
              ownerIds: input.owner_ids,
              lifecycle: input.lifecycle,
              ...writeBody(input),
            },
          },
        ),
      ),
  );

  server.registerTool(
    'create_action_item',
    {
      description:
        '创建无法归入具体需求的零碎待办。项目和需求都可省略；不要为了容纳待办而虚构项目。默认负责人也必须使用已确认的人员 ID。',
      inputSchema: {
        title: z.string().min(1),
        description: z.string().optional(),
        project_id: uuidSchema.optional(),
        requirement_id: uuidSchema.optional(),
        owner_ids: uuidListSchema.optional(),
        planned_start_at: z.string().optional(),
        planned_end_at: z.string().optional(),
        ...sourceSchema,
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request('/action-items', {
          method: 'POST',
          body: {
            title: input.title,
            description: input.description,
            projectId: input.project_id,
            requirementId: input.requirement_id,
            ownerIds: input.owner_ids,
            plannedStartAt: input.planned_start_at,
            plannedEndAt: input.planned_end_at,
            ...writeBody(input),
          },
        }),
      ),
  );

  server.registerTool(
    'update_action_item',
    {
      description:
        '修改零碎待办的标题、说明或归属。负责人使用 assign_owners，状态和排期分别使用专用工具；只传需要改变的字段。',
      inputSchema: {
        action_item_id: uuidSchema,
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        project_id: uuidSchema.nullable().optional(),
        requirement_id: uuidSchema.nullable().optional(),
        ...sourceSchema,
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(
          `/action-items/${encodeURIComponent(input.action_item_id)}`,
          {
            method: 'PATCH',
            body: {
              title: input.title,
              description: input.description,
              projectId: input.project_id,
              requirementId: input.requirement_id,
              ...writeBody(input),
            },
          },
        ),
      ),
  );

  server.registerTool(
    'assign_owners',
    {
      description:
        '为需求、阶段、Bug 或零碎待办分配负责人。空数组表示清空为待分配；人员 ID 必须先由 search 确认。',
      inputSchema: {
        target_type: assignableTypeSchema,
        target_id: uuidSchema,
        owner_ids: uuidListSchema,
        ...sourceSchema,
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(
          `/${collectionOf(input.target_type)}/${encodeURIComponent(input.target_id)}`,
          {
            method: 'PATCH',
            body: { ownerIds: input.owner_ids, ...writeBody(input) },
          },
        ),
      ),
  );

  server.registerTool(
    'move_requirement_to_version',
    {
      description:
        '调整需求目标版本并保留迁移历史。version_id 传 null 或省略表示移回需求池；effective_at 用于事后补录。',
      inputSchema: {
        requirement_id: uuidSchema,
        version_id: optionalUuidSchema.nullable().optional(),
        effective_at: z.string().optional(),
        agent_name: sourceSchema.agent_name,
        agent_model: sourceSchema.agent_model,
        request_id: sourceSchema.request_id,
        source_ref: sourceSchema.source_ref,
        reported_at: sourceSchema.reported_at,
        reason: z.string().min(1).describe('调整版本的原因'),
      },
      annotations: writeAnnotations,
    },
    async (input) => {
      const versionId = optionalId(input.version_id) ?? null;
      return writeResult(
        api,
        await api.request(
          `/requirements/${encodeURIComponent(input.requirement_id)}/move-version`,
          {
            method: 'POST',
            body: {
              versionId,
              effectiveAt: input.effective_at,
              ...writeBody(input),
            },
          },
        ),
      );
    },
  );

  server.registerTool(
    'add_stage',
    {
      description:
        '在需求实际流程中增加环节。有独立名称、负责人、状态或时间的工作必须作为独立阶段，不能塞进泛化的“开发”阶段。order 是从 0 开始的插入位置；不传才追加到末尾。等待或阻塞应改状态，不应创建新阶段。',
      inputSchema: {
        requirement_id: uuidSchema,
        name: z.string().min(1),
        work_domain: stageWorkDomainSchema
          .optional()
          .describe('跨需求聚焦使用的工作域；省略时按名称推断'),
        order: z.number().int().min(0).optional(),
        owner_ids: uuidListSchema.default([]),
        note: z.string().optional(),
        planned_start_at: z.string().optional(),
        planned_end_at: z.string().optional(),
        ...sourceSchema,
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(
          `/requirements/${encodeURIComponent(input.requirement_id)}/stages`,
          {
            method: 'POST',
            body: {
              name: input.name,
              workDomain: input.work_domain,
              order: input.order,
              ownerIds: input.owner_ids,
              note: input.note,
              plannedStartAt: input.planned_start_at,
              plannedEndAt: input.planned_end_at,
              ...writeBody(input),
            },
          },
        ),
      ),
  );

  server.registerTool(
    'update_stage',
    {
      description:
        '修改既有阶段的名称、工作域、说明或顺序。只传需要修改的字段；order 从 0 开始。负责人使用 assign_owners，状态使用 update_stage_status，排期使用 reschedule_stage。',
      inputSchema: {
        stage_id: uuidSchema,
        name: z.string().min(1).optional(),
        work_domain: stageWorkDomainSchema.optional(),
        note: z.string().optional(),
        order: z.number().int().min(0).optional(),
        ...sourceSchema,
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(`/stages/${encodeURIComponent(input.stage_id)}`, {
          method: 'PATCH',
          body: {
            name: input.name,
            workDomain: input.work_domain,
            note: input.note,
            order: input.order,
            ...writeBody(input),
          },
        }),
      ),
  );

  server.registerTool(
    'update_stage_status',
    {
      description:
        '改变阶段状态并追加历史。进入 waiting 或 blocked 时 status_reason 必填；恢复条件明确用 waiting，不明确用 blocked。可传时间补录。',
      inputSchema: {
        stage_id: uuidSchema,
        status: statusSchema,
        owner_ids: uuidListSchema.optional(),
        effective_at: z.string().optional(),
        actual_start_at: z.string().optional(),
        actual_end_at: z.string().optional(),
        status_reason: z.string().optional(),
        expected_resume_at: z.string().optional(),
        note: z.string().optional(),
        ...sourceSchema,
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(
          `/stages/${encodeURIComponent(input.stage_id)}/status`,
          {
            method: 'POST',
            body: {
              status: input.status,
              ownerIds: input.owner_ids,
              effectiveAt: input.effective_at,
              actualStartAt: input.actual_start_at,
              actualEndAt: input.actual_end_at,
              statusReason: input.status_reason,
              expectedResumeAt: input.expected_resume_at,
              note: input.note,
              ...writeBody(input),
            },
          },
        ),
      ),
  );

  server.registerTool(
    'reschedule_stage',
    {
      description:
        '调整阶段当前计划并保留初始基线和排期历史。null 表示清空该端时间，不传表示不修改。',
      inputSchema: {
        stage_id: uuidSchema,
        planned_start_at: z.string().nullable().optional(),
        planned_end_at: z.string().nullable().optional(),
        agent_name: sourceSchema.agent_name,
        agent_model: sourceSchema.agent_model,
        request_id: sourceSchema.request_id,
        source_ref: sourceSchema.source_ref,
        reported_at: sourceSchema.reported_at,
        reason: z.string().min(1).describe('排期调整原因'),
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(
          `/stages/${encodeURIComponent(input.stage_id)}/reschedule`,
          {
            method: 'POST',
            body: {
              plannedStartAt: input.planned_start_at,
              plannedEndAt: input.planned_end_at,
              ...writeBody(input),
            },
          },
        ),
      ),
  );

  server.registerTool(
    'report_bug',
    {
      description:
        '在需求下创建可独立描述、分配、排期和验收的 Bug。若只是开发流程中需要单独追踪的一段返工，应考虑 add_stage。',
      inputSchema: {
        requirement_id: uuidSchema,
        title: z.string().min(1),
        description: z.string().optional(),
        owner_ids: uuidListSchema.default([]),
        discovered_stage_id: uuidSchema.optional(),
        discovered_version_id: uuidSchema.optional(),
        target_version_id: uuidSchema.optional(),
        planned_start_at: z.string().optional(),
        planned_end_at: z.string().optional(),
        ...sourceSchema,
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(
          `/requirements/${encodeURIComponent(input.requirement_id)}/bugs`,
          {
            method: 'POST',
            body: {
              title: input.title,
              description: input.description,
              ownerIds: input.owner_ids,
              discoveredStageId: input.discovered_stage_id,
              discoveredVersionId: input.discovered_version_id,
              targetVersionId: input.target_version_id,
              plannedStartAt: input.planned_start_at,
              plannedEndAt: input.planned_end_at,
              ...writeBody(input),
            },
          },
        ),
      ),
  );

  server.registerTool(
    'update_bug_status',
    {
      description:
        '改变 Bug 状态并追加历史。进入 waiting 或 blocked 时 status_reason 必填；可传时间补录真实过程。',
      inputSchema: {
        bug_id: uuidSchema,
        status: statusSchema,
        owner_ids: uuidListSchema.optional(),
        effective_at: z.string().optional(),
        actual_start_at: z.string().optional(),
        actual_end_at: z.string().optional(),
        status_reason: z.string().optional(),
        expected_resume_at: z.string().optional(),
        note: z.string().optional(),
        ...sourceSchema,
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(`/bugs/${encodeURIComponent(input.bug_id)}/status`, {
          method: 'POST',
          body: {
            status: input.status,
            ownerIds: input.owner_ids,
            effectiveAt: input.effective_at,
            actualStartAt: input.actual_start_at,
            actualEndAt: input.actual_end_at,
            statusReason: input.status_reason,
            expectedResumeAt: input.expected_resume_at,
            note: input.note,
            ...writeBody(input),
          },
        }),
      ),
  );

  server.registerTool(
    'correct_status_history',
    {
      description:
        '修正一条已存在的阶段、Bug 或零碎待办状态历史，并重算实际起止时间。这与追加一条补记不同；必须先读取目标确认历史 ID。',
      inputSchema: {
        history_id: uuidSchema,
        status: statusSchema.optional(),
        effective_at: z.string().optional(),
        note: z.string().optional(),
        status_reason: z.string().optional(),
        expected_resume_at: z.string().nullable().optional(),
        agent_name: sourceSchema.agent_name,
        agent_model: sourceSchema.agent_model,
        request_id: sourceSchema.request_id,
        source_ref: sourceSchema.source_ref,
        reported_at: sourceSchema.reported_at,
        reason: z.string().min(1).describe('修正这条历史记录的原因'),
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(
          `/history/status/${encodeURIComponent(input.history_id)}`,
          {
            method: 'PATCH',
            body: {
              status: input.status,
              effectiveAt: input.effective_at,
              note: input.note,
              statusReason: input.status_reason,
              expectedResumeAt: input.expected_resume_at,
              ...writeBody(input),
            },
          },
        ),
      ),
  );

  server.registerTool(
    'reschedule_bug',
    {
      description:
        '调整 Bug 当前计划并保留初始基线和排期历史。null 表示清空该端时间。',
      inputSchema: {
        bug_id: uuidSchema,
        planned_start_at: z.string().nullable().optional(),
        planned_end_at: z.string().nullable().optional(),
        agent_name: sourceSchema.agent_name,
        agent_model: sourceSchema.agent_model,
        request_id: sourceSchema.request_id,
        source_ref: sourceSchema.source_ref,
        reported_at: sourceSchema.reported_at,
        reason: z.string().min(1).describe('排期调整原因'),
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(
          `/bugs/${encodeURIComponent(input.bug_id)}/reschedule`,
          {
            method: 'POST',
            body: {
              plannedStartAt: input.planned_start_at,
              plannedEndAt: input.planned_end_at,
              ...writeBody(input),
            },
          },
        ),
      ),
  );

  server.registerTool(
    'update_action_item_status',
    {
      description:
        '改变零碎待办状态并追加历史。进入 waiting 或 blocked 时必须说明原因；effective_at 可补录真实发生时间。',
      inputSchema: {
        action_item_id: uuidSchema,
        status: statusSchema,
        owner_ids: uuidListSchema.optional(),
        effective_at: z.string().optional(),
        actual_start_at: z.string().optional(),
        actual_end_at: z.string().optional(),
        status_reason: z.string().optional(),
        expected_resume_at: z.string().optional(),
        note: z.string().optional(),
        ...sourceSchema,
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(
          `/action-items/${encodeURIComponent(input.action_item_id)}/status`,
          {
            method: 'POST',
            body: {
              status: input.status,
              ownerIds: input.owner_ids,
              effectiveAt: input.effective_at,
              actualStartAt: input.actual_start_at,
              actualEndAt: input.actual_end_at,
              statusReason: input.status_reason,
              expectedResumeAt: input.expected_resume_at,
              note: input.note,
              ...writeBody(input),
            },
          },
        ),
      ),
  );

  server.registerTool(
    'reschedule_action_item',
    {
      description:
        '调整零碎待办当前计划并保留初始基线和排期历史。null 表示清空该端时间；调整必须说明原因。',
      inputSchema: {
        action_item_id: uuidSchema,
        planned_start_at: z.string().nullable().optional(),
        planned_end_at: z.string().nullable().optional(),
        agent_name: sourceSchema.agent_name,
        agent_model: sourceSchema.agent_model,
        request_id: sourceSchema.request_id,
        source_ref: sourceSchema.source_ref,
        reported_at: sourceSchema.reported_at,
        reason: z.string().min(1).describe('排期调整原因'),
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(
          `/action-items/${encodeURIComponent(input.action_item_id)}/reschedule`,
          {
            method: 'POST',
            body: {
              plannedStartAt: input.planned_start_at,
              plannedEndAt: input.planned_end_at,
              ...writeBody(input),
            },
          },
        ),
      ),
  );

  server.registerTool(
    'add_dependency',
    {
      description:
        '建立需求、阶段或 Bug 之间的依赖，可跨项目。优先指向真正影响交付的具体阶段。依赖未满足只返回 warnings，不阻止操作。',
      inputSchema: {
        successor_type: targetTypeSchema,
        successor_id: uuidSchema,
        predecessor_type: targetTypeSchema,
        predecessor_id: uuidSchema,
        note: z.string().optional(),
        ...sourceSchema,
      },
      annotations: writeAnnotations,
    },
    async (input) => {
      const entity = await api.request<DependencyValue>('/dependencies', {
        method: 'POST',
        body: {
          successorType: input.successor_type,
          successorId: input.successor_id,
          predecessorType: input.predecessor_type,
          predecessorId: input.predecessor_id,
          note: input.note,
          ...writeBody(input),
        },
      });
      const warnings: ToolWarning[] =
        entity.satisfied === false
          ? [
              {
                code: 'dependency_not_satisfied',
                dependency_id: entity.id,
                message: '依赖已建立，但前置事项尚未完成。该警告不阻止推进。',
              },
            ]
          : [];
      return writeResult(api, entity, warnings);
    },
  );

  server.registerTool(
    'remove_dependency',
    {
      description:
        '停用一条不再成立的依赖并保留变化记录。这不会删除任何需求、阶段或 Bug。',
      inputSchema: {
        dependency_id: uuidSchema,
        agent_name: sourceSchema.agent_name,
        agent_model: sourceSchema.agent_model,
        request_id: sourceSchema.request_id,
        source_ref: sourceSchema.source_ref,
        reported_at: sourceSchema.reported_at,
        reason: z.string().min(1).describe('依赖不再成立的原因'),
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(
          `/dependencies/${encodeURIComponent(input.dependency_id)}/resolve`,
          { method: 'POST', body: writeBody(input) },
        ),
      ),
  );

  server.registerTool(
    'preview_changes',
    {
      description:
        '只读演练一组相互关联的结构修改，返回逐项差异、对账结果和确认令牌，数据库会完整回滚。服务支持的已有流程调整中，取消旧阶段、迁移依赖或执行三项以上关联写入前必须先调用；不支持的创建需求、Bug、版本迁移和待办不能放入此计划；依赖只能来自用户明确事实，不得把 Agent 推测直接写入计划。计划应先新增替代结构和正确依赖，最后再停用旧项。预演产生的新对象 UUID 是临时值，后续关联必须使用 operation_id。',
      inputSchema: {
        project_id: uuidSchema,
        reason: z.string().min(1).describe('整组变更的业务原因'),
        operations: z.array(changeSetOperationSchema).min(1).max(100),
        agent_name: sourceSchema.agent_name,
        agent_model: sourceSchema.agent_model,
        request_id: sourceSchema.request_id,
        source_ref: sourceSchema.source_ref,
        reported_at: sourceSchema.reported_at,
      },
      annotations: readAnnotations,
    },
    async (input) =>
      readResult(
        await api.request('/changes/preview', {
          method: 'POST',
          body: {
            projectId: input.project_id,
            operations: input.operations.map(changeSetOperationBody),
            ...writeBody(input),
          },
        }),
      ),
  );

  server.registerTool(
    'apply_changes',
    {
      description:
        '原子执行已经由 preview_changes 演练且获授权的完整计划。同一具体计划已获授权时无需重复确认；新增业务选择或影响范围改变时先确认。必须原样提交相同 operations 和确认令牌；任一操作失败时整组回滚，项目状态变化后令牌失效。执行后检查返回的 changes 与 reconciliation，不得把部分结果描述成全部完成。',
      inputSchema: {
        project_id: uuidSchema,
        reason: z.string().min(1).describe('必须与预览时完全一致'),
        operations: z.array(changeSetOperationSchema).min(1).max(100),
        confirmation_token: z.string().length(64),
        agent_name: sourceSchema.agent_name,
        agent_model: sourceSchema.agent_model,
        request_id: sourceSchema.request_id,
        source_ref: sourceSchema.source_ref,
        reported_at: sourceSchema.reported_at,
      },
      annotations: coordinatedWriteAnnotations,
    },
    async (input) =>
      readResult(
        await api.request('/changes/apply', {
          method: 'POST',
          body: {
            projectId: input.project_id,
            operations: input.operations.map(changeSetOperationBody),
            confirmationToken: input.confirmation_token,
            ...writeBody(input),
          },
        }),
      ),
  );

  server.registerTool(
    'delete_work_item',
    {
      description:
        '删除明确不再使用的空版本，或明确误建的需求、阶段或 Bug。版本必须已经移空；必须先读取目标并获得用户明确授权，历史仍保留。',
      inputSchema: {
        target_type: deletableTypeSchema,
        target_id: uuidSchema,
        confirmation: z
          .string()
          .describe('版本名称、需求编号、阶段名称或 Bug 编号'),
        reason: z.string().min(1),
        agent_name: sourceSchema.agent_name,
        agent_model: sourceSchema.agent_model,
        request_id: sourceSchema.request_id,
        source_ref: sourceSchema.source_ref,
        reported_at: sourceSchema.reported_at,
      },
      annotations: { ...writeAnnotations, destructiveHint: true },
    },
    async (input) => {
      const result = await api.request<JsonObject>(
        `/${collectionOf(input.target_type)}/${encodeURIComponent(input.target_id)}`,
        {
          method: 'DELETE',
          body: { confirmation: input.confirmation, ...writeBody(input) },
        },
      );
      return textResult({
        success: true,
        entity: {
          type: input.target_type,
          id: input.target_id,
          deleted: true,
        },
        mutation: result?._mutation,
        history: { reason: input.reason },
        warnings: [],
      });
    },
  );

  for (const resource of flowTraceResources) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        title: resource.title,
        description: resource.description,
        mimeType: 'text/markdown',
      },
      async () => ({
        contents: [
          {
            uri: resource.uri,
            mimeType: 'text/markdown',
            text: resource.text,
          },
        ],
      }),
    );
  }

  return server;
}
