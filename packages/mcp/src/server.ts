import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FlowTraceApiClient } from './api-client.js';
import { flowTraceResources } from './resources.js';

const instructions = `FlowTrace 记录研发交付的真实过程。Project 是长期研发对象，Version 是一次计划交付，Requirement 下有 Stage 和 Bug。Stage 是工作环节，Status 是执行状态，两者不可混用。Baseline 不得被后续排期覆盖，状态和排期修改必须保留历史。独立缺陷优先创建 Bug。Waiting 表示恢复条件明确，Blocked 表示恢复条件不明确，二者都必须记录原因。查询整体状态优先 Snapshot；其中 activeStages 是全部并行活跃阶段，reviewItems 是待补全项，currentStage 只用于兼容摘要，不能代表全部事实。查询近期变化优先 Changes Since。名称搜索有多个结果时不得猜测。所有写入必须经由业务 Tool。`;

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
const sourceSchema = {
  agent_name: z
    .string()
    .default('FlowTrace MCP')
    .describe('写入来源名称，用于历史审计'),
  reason: z.string().optional().describe('本次修改的业务原因'),
};
const entityTypeSchema = z.enum([
  'project',
  'version',
  'requirement',
  'stage',
  'bug',
  'person',
]);
const targetTypeSchema = z.enum(['requirement', 'stage', 'bug']);
const statusSchema = z.enum([
  'not_started',
  'in_progress',
  'waiting',
  'blocked',
  'done',
  'canceled',
]);

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
const readResult = (data: unknown) => textResult({ success: true, data });
const writeBody = (input: { agent_name: string; reason?: string }) => ({
  source: 'agent',
  agentName: input.agent_name,
  reason: input.reason,
});
const collectionOf = (type: 'requirement' | 'stage' | 'bug') =>
  ({ requirement: 'requirements', stage: 'stages', bug: 'bugs' })[type];
const latest = (value: unknown) =>
  Array.isArray(value) && value.length ? value.at(-1) : undefined;

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
  return textResult({
    success: true,
    entity,
    history: historySummary(entity),
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
    { name: 'flowtrace', version: '0.2.0' },
    { instructions },
  );

  server.registerTool(
    'search',
    {
      description:
        '搜索或列举业务对象，返回稳定 ID 和项目、版本消歧上下文。query 留空可按类型列举；多个结果时必须让用户消歧，不得猜测。',
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
            'person',
          ]),
        limit: z.number().int().min(1).max(50).default(20),
      },
      annotations: readAnnotations,
    },
    async ({ query, types, limit }) => {
      const queryString = new URLSearchParams({
        q: query,
        types: types.join(','),
        limit: String(limit),
      });
      return readResult(await api.request(`/search?${queryString}`));
    },
  );

  server.registerTool(
    'get_project_snapshot',
    {
      description:
        '一次读取项目计数、需求摘要、等待、阻塞、延期、开放 Bug、外部依赖和最近变化。回答项目整体状态时优先使用。',
      inputSchema: {
        project_id: z.string().describe('由 search 获得的项目稳定 ID'),
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
    'get_version_snapshot',
    {
      description:
        '一次读取某次计划交付的进展、风险和最近变化。回答“某版本现在怎么样”时优先使用。',
      inputSchema: {
        version_id: z.string().describe('由 search 获得的版本稳定 ID'),
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
        project_id: z.string().describe('由 search 获得的项目稳定 ID'),
        name: z.string().min(1),
        status: z
          .enum(['planning', 'active', 'released', 'canceled'])
          .default('planning'),
        planned_start_at: z.string().optional(),
        planned_release_at: z.string().optional(),
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
        '修改已存在 Version 的名称、状态、顺序或计划，并保留审计变化。只传需要修改的字段，排期或状态调整必须说明原因。',
      inputSchema: {
        version_id: z.string(),
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
        requirement_id: z.string().describe('需求稳定 ID 或可读编号'),
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
        project_id: z.string().optional(),
        version_id: z.string().optional(),
        requirement_id: z.string().optional(),
        limit: z.number().int().min(1).max(300).default(100),
      },
      annotations: readAnnotations,
    },
    async ({ since, project_id, version_id, requirement_id, limit }) => {
      const query = new URLSearchParams({ since, limit: String(limit) });
      if (project_id) query.set('projectId', project_id);
      if (version_id) query.set('versionId', version_id);
      if (requirement_id) query.set('requirementId', requirement_id);
      return readResult(await api.request(`/changes?${query}`));
    },
  );

  server.registerTool(
    'create_requirement',
    {
      description:
        '在明确项目和版本中创建需求。stages 省略时复制项目模板；来源已给出真实工作分解时直接传 stages，避免先复制再取消。',
      inputSchema: {
        project_id: z.string().describe('项目稳定 ID'),
        version_id: z.string().optional().describe('省略则放入需求池'),
        title: z.string().min(1),
        description: z.string().optional(),
        owner_ids: z.array(z.string()).default([]),
        planned_start_at: z.string().optional(),
        planned_end_at: z.string().optional(),
        stages: z
          .array(
            z.object({
              name: z.string().min(1),
              owner_ids: z.array(z.string()).default([]),
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
    async (input) =>
      writeResult(
        api,
        await api.request('/requirements', {
          method: 'POST',
          body: {
            projectId: input.project_id,
            versionId: input.version_id,
            title: input.title,
            description: input.description,
            ownerIds: input.owner_ids,
            plannedStartAt: input.planned_start_at,
            plannedEndAt: input.planned_end_at,
            stages: input.stages?.map((stage) => ({
              name: stage.name,
              ownerIds: stage.owner_ids,
              note: stage.note,
              plannedStartAt: stage.planned_start_at,
              plannedEndAt: stage.planned_end_at,
            })),
            ...writeBody(input),
          },
        }),
      ),
  );

  server.registerTool(
    'update_requirement',
    {
      description:
        '修改需求标题、说明、协调人或生命周期。先 get_requirement 核对当前值，只传需改字段；阶段状态不得用此工具修改。',
      inputSchema: {
        requirement_id: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        owner_ids: z.array(z.string()).optional(),
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
    'assign_owners',
    {
      description:
        '为需求、阶段或 Bug 分配独立负责人。空数组表示清空为待分配；人员 ID 必须先由 search 确认。',
      inputSchema: {
        target_type: targetTypeSchema,
        target_id: z.string(),
        owner_ids: z.array(z.string()),
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
        requirement_id: z.string(),
        version_id: z.string().nullable().optional(),
        effective_at: z.string().optional(),
        agent_name: sourceSchema.agent_name,
        reason: z.string().min(1).describe('调整版本的原因'),
      },
      annotations: writeAnnotations,
    },
    async (input) =>
      writeResult(
        api,
        await api.request(
          `/requirements/${encodeURIComponent(input.requirement_id)}/move-version`,
          {
            method: 'POST',
            body: {
              versionId: input.version_id,
              effectiveAt: input.effective_at,
              ...writeBody(input),
            },
          },
        ),
      ),
  );

  server.registerTool(
    'add_stage',
    {
      description:
        '在需求实际流程中增加环节。order 是从 0 开始的插入位置；不传才追加到末尾。等待或阻塞应改状态，不应创建新阶段。',
      inputSchema: {
        requirement_id: z.string(),
        name: z.string().min(1),
        order: z.number().int().min(0).optional(),
        owner_ids: z.array(z.string()).default([]),
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
    'update_stage_status',
    {
      description:
        '改变阶段状态并追加历史。进入 waiting 或 blocked 时 status_reason 必填；恢复条件明确用 waiting，不明确用 blocked。可传时间补录。',
      inputSchema: {
        stage_id: z.string(),
        status: statusSchema,
        owner_ids: z.array(z.string()).optional(),
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
        stage_id: z.string(),
        planned_start_at: z.string().nullable().optional(),
        planned_end_at: z.string().nullable().optional(),
        agent_name: sourceSchema.agent_name,
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
        requirement_id: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        owner_ids: z.array(z.string()).default([]),
        discovered_stage_id: z.string().optional(),
        discovered_version_id: z.string().optional(),
        target_version_id: z.string().optional(),
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
        bug_id: z.string(),
        status: statusSchema,
        owner_ids: z.array(z.string()).optional(),
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
        '修正一条已存在的阶段或 Bug 状态历史，并重算实际起止时间。这与在过去追加一条补记不同；必须先通过 get_requirement 确认历史 ID。',
      inputSchema: {
        history_id: z.string(),
        status: statusSchema.optional(),
        effective_at: z.string().optional(),
        note: z.string().optional(),
        status_reason: z.string().optional(),
        expected_resume_at: z.string().nullable().optional(),
        agent_name: sourceSchema.agent_name,
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
        bug_id: z.string(),
        planned_start_at: z.string().nullable().optional(),
        planned_end_at: z.string().nullable().optional(),
        agent_name: sourceSchema.agent_name,
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
    'add_dependency',
    {
      description:
        '建立需求、阶段或 Bug 之间的依赖，可跨项目。优先指向真正影响交付的具体阶段。依赖未满足只返回 warnings，不阻止操作。',
      inputSchema: {
        successor_type: targetTypeSchema,
        successor_id: z.string(),
        predecessor_type: targetTypeSchema,
        predecessor_id: z.string(),
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
        dependency_id: z.string(),
        agent_name: sourceSchema.agent_name,
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
    'delete_work_item',
    {
      description:
        '仅用于删除明确误建的需求、阶段或 Bug。必须先读取目标并获得用户明确授权；有历史或关联时仍保留审计数据。',
      inputSchema: {
        target_type: targetTypeSchema,
        target_id: z.string(),
        confirmation: z.string().describe('需求编号、阶段名称或 Bug 编号'),
        reason: z.string().min(1),
        agent_name: sourceSchema.agent_name,
      },
      annotations: { ...writeAnnotations, destructiveHint: true },
    },
    async (input) => {
      await api.request(
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
