import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FlowTraceApiClient } from './api-client.js';

const sourceSchema = {
  agent_name: z.string().default('FlowTrace MCP Agent').describe('调用方名称'),
  reason: z.string().optional().describe('本次修改的业务原因'),
};

const statusSchema = z.enum([
  'not_started',
  'in_progress',
  'waiting',
  'blocked',
  'done',
  'canceled',
]);

const result = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: { result: data },
});

const writeBody = (input: { agent_name: string; reason?: string }) => ({
  source: 'agent',
  agentName: input.agent_name,
  reason: input.reason,
});

export function createFlowTraceMcpServer(
  api = new FlowTraceApiClient(),
): McpServer {
  const server = new McpServer({
    name: 'flowtrace',
    version: '0.1.0',
  });

  server.registerTool(
    'list_projects',
    {
      description: '列出所有项目及未完成、等待中、阻塞和延期指标。',
    },
    async () => result(await api.request('/projects')),
  );

  server.registerTool(
    'list_people',
    {
      description: '列出当前可分配的负责人及其稳定 ID。',
    },
    async () => result(await api.request('/people')),
  );

  server.registerTool(
    'list_versions',
    {
      description: '列出指定项目的交付版本。',
      inputSchema: {
        project_id: z.string().describe('项目稳定 ID'),
      },
    },
    async ({ project_id }) =>
      result(
        await api.request(
          `/projects/${encodeURIComponent(project_id)}/versions`,
        ),
      ),
  );

  server.registerTool(
    'get_project_snapshot',
    {
      description: '一次读取项目进展、风险、未完成 Bug、外部依赖和最近变化。',
      inputSchema: { project_id: z.string() },
    },
    async ({ project_id }) =>
      result(
        await api.request(
          `/snapshots/projects/${encodeURIComponent(project_id)}`,
        ),
      ),
  );

  server.registerTool(
    'get_version_snapshot',
    {
      description: '一次读取版本进展，适合生成进度摘要。',
      inputSchema: { version_id: z.string() },
    },
    async ({ version_id }) =>
      result(
        await api.request(
          `/snapshots/versions/${encodeURIComponent(version_id)}`,
        ),
      ),
  );

  server.registerTool(
    'get_requirement',
    {
      description: '通过稳定 ID 或可读编号读取需求的完整阶段、Bug 和历史。',
      inputSchema: { requirement_id: z.string() },
    },
    async ({ requirement_id }) =>
      result(
        await api.request(
          `/requirements/${encodeURIComponent(requirement_id)}`,
        ),
      ),
  );

  server.registerTool(
    'create_requirement',
    {
      description: '创建需求并复制项目当前阶段模板。',
      inputSchema: {
        project_id: z.string(),
        version_id: z.string().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        owner_ids: z.array(z.string()).default([]),
        planned_start_at: z.string().optional(),
        planned_end_at: z.string().optional(),
        ...sourceSchema,
      },
    },
    async (input) =>
      result(
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
            ...writeBody(input),
          },
        }),
      ),
  );

  server.registerTool(
    'assign_owners',
    {
      description:
        '为需求、阶段或 Bug 分配独立负责人，可选择多人或清空为待分配。',
      inputSchema: {
        target_type: z.enum(['requirement', 'stage', 'bug']),
        target_id: z.string().describe('事项稳定 ID'),
        owner_ids: z.array(z.string()).describe('人员稳定 ID 列表'),
        ...sourceSchema,
      },
    },
    async (input) => {
      const collection = {
        requirement: 'requirements',
        stage: 'stages',
        bug: 'bugs',
      }[input.target_type];
      return result(
        await api.request(
          `/${collection}/${encodeURIComponent(input.target_id)}`,
          {
            method: 'PATCH',
            body: {
              ownerIds: input.owner_ids,
              ...writeBody(input),
            },
          },
        ),
      );
    },
  );

  server.registerTool(
    'move_requirement_to_version',
    {
      description:
        '移动需求的目标版本，并保留版本迁移历史；不传版本表示移回 Backlog。',
      inputSchema: {
        requirement_id: z.string(),
        version_id: z.string().nullable().optional(),
        ...sourceSchema,
      },
    },
    async (input) =>
      result(
        await api.request(
          `/requirements/${encodeURIComponent(input.requirement_id)}/move-version`,
          {
            method: 'POST',
            body: { versionId: input.version_id, ...writeBody(input) },
          },
        ),
      ),
  );

  server.registerTool(
    'add_stage',
    {
      description: '在需求中动态增加返工、打样、验证等实际阶段。',
      inputSchema: {
        requirement_id: z.string(),
        name: z.string().min(1),
        owner_ids: z.array(z.string()).default([]),
        note: z.string().optional(),
        planned_start_at: z.string().optional(),
        planned_end_at: z.string().optional(),
        ...sourceSchema,
      },
    },
    async (input) =>
      result(
        await api.request(
          `/requirements/${encodeURIComponent(input.requirement_id)}/stages`,
          {
            method: 'POST',
            body: {
              name: input.name,
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
        '更新阶段状态，支持补录过去的生效时间；进入等待中或阻塞必须说明原因。',
      inputSchema: {
        stage_id: z.string(),
        status: statusSchema,
        effective_at: z.string().optional(),
        status_reason: z.string().optional(),
        expected_resume_at: z.string().optional(),
        note: z.string().optional(),
        ...sourceSchema,
      },
    },
    async (input) =>
      result(
        await api.request(
          `/stages/${encodeURIComponent(input.stage_id)}/status`,
          {
            method: 'POST',
            body: {
              status: input.status,
              effectiveAt: input.effective_at,
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
      description: '调整阶段当前计划，并保留初始基线和全部排期变化。',
      inputSchema: {
        stage_id: z.string(),
        planned_start_at: z.string().nullable().optional(),
        planned_end_at: z.string().nullable().optional(),
        ...sourceSchema,
      },
    },
    async (input) =>
      result(
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
      description: '在需求下创建可独立跟踪的 Bug。',
      inputSchema: {
        requirement_id: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        owner_ids: z.array(z.string()).default([]),
        discovered_stage_id: z.string().optional(),
        target_version_id: z.string().optional(),
        ...sourceSchema,
      },
    },
    async (input) =>
      result(
        await api.request(
          `/requirements/${encodeURIComponent(input.requirement_id)}/bugs`,
          {
            method: 'POST',
            body: {
              title: input.title,
              description: input.description,
              ownerIds: input.owner_ids,
              discoveredStageId: input.discovered_stage_id,
              targetVersionId: input.target_version_id,
              ...writeBody(input),
            },
          },
        ),
      ),
  );

  server.registerTool(
    'update_bug_status',
    {
      description: '更新 Bug 状态并保留历史，支持补录生效时间。',
      inputSchema: {
        bug_id: z.string(),
        status: statusSchema,
        effective_at: z.string().optional(),
        status_reason: z.string().optional(),
        expected_resume_at: z.string().optional(),
        note: z.string().optional(),
        ...sourceSchema,
      },
    },
    async (input) =>
      result(
        await api.request(`/bugs/${encodeURIComponent(input.bug_id)}/status`, {
          method: 'POST',
          body: {
            status: input.status,
            effectiveAt: input.effective_at,
            statusReason: input.status_reason,
            expectedResumeAt: input.expected_resume_at,
            note: input.note,
            ...writeBody(input),
          },
        }),
      ),
  );

  server.registerTool(
    'add_dependency',
    {
      description:
        '建立需求、阶段或 Bug 之间的依赖，可跨项目且不会强制阻止推进。',
      inputSchema: {
        successor_type: z.enum(['requirement', 'stage', 'bug']),
        successor_id: z.string(),
        predecessor_type: z.enum(['requirement', 'stage', 'bug']),
        predecessor_id: z.string(),
        note: z.string().optional(),
        ...sourceSchema,
      },
    },
    async (input) =>
      result(
        await api.request('/dependencies', {
          method: 'POST',
          body: {
            successorType: input.successor_type,
            successorId: input.successor_id,
            predecessorType: input.predecessor_type,
            predecessorId: input.predecessor_id,
            note: input.note,
            ...writeBody(input),
          },
        }),
      ),
  );

  server.registerTool(
    'get_changes_since',
    {
      description: '获取指定时间之后的结构化变化，用于日报、周报和会议回顾。',
      inputSchema: {
        since: z.string().describe('ISO 8601 时间'),
        project_id: z.string().optional(),
      },
    },
    async ({ since, project_id }) => {
      const query = new URLSearchParams({ since });
      if (project_id) query.set('projectId', project_id);
      return result(await api.request(`/changes?${query.toString()}`));
    },
  );

  return server;
}
