import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';
import type { FlowTraceApiClient } from '../src/api-client.js';
import { createFlowTraceMcpServer } from '../src/server.js';

describe('FlowTrace MCP Server', () => {
  it('provides a self-describing bounded catalog, resources and audited writes', async () => {
    const request = vi.fn(async (path: string) => {
      if (path.startsWith('/search/page?')) {
        return {
          items: [
            {
              type: 'project',
              id: '00000000-0000-4000-8000-000000000001',
              key: 'DEMO',
              name: '演示项目',
            },
          ],
          total: 1,
          hasMore: false,
        };
      }
      if (path.startsWith('/dependencies?')) {
        return [
          {
            id: '00000000-0000-4000-8000-000000000002',
            active: true,
            satisfied: false,
            successor: {
              requirementId: '00000000-0000-4000-8000-000000000003',
            },
            predecessor: { projectName: '前置项目', name: '准备样件' },
          },
        ];
      }
      if (
        path ===
        '/projects/00000000-0000-4000-8000-000000000001/agent-handoff/history'
      ) {
        return [
          {
            id: '00000000-0000-4000-8000-000000000004',
            projectId: '00000000-0000-4000-8000-000000000001',
            revision: 1,
            content: '先确认版本边界。',
            source: 'agent',
          },
        ];
      }
      if (
        path === '/projects/00000000-0000-4000-8000-000000000001/agent-handoff'
      ) {
        return {
          projectId: '00000000-0000-4000-8000-000000000001',
          revision: 1,
          content: '先确认版本边界。',
          source: 'agent',
        };
      }
      if (path === '/changes/preview') {
        return {
          projectId: '00000000-0000-4000-8000-000000000001',
          confirmationToken: 'a'.repeat(64),
          operations: [],
          changes: [],
          reconciliation: {
            requirementCount: 1,
            stageCount: 2,
            activeDependencyCount: 1,
            reviewItems: [],
          },
        };
      }
      if (path === '/changes/apply') {
        return {
          projectId: '00000000-0000-4000-8000-000000000001',
          confirmationToken: 'a'.repeat(64),
          operations: [],
          changes: [],
          reconciliation: {
            requirementCount: 1,
            stageCount: 2,
            activeDependencyCount: 1,
            reviewItems: [],
          },
          applied: true,
        };
      }
      return {
        id: '00000000-0000-4000-8000-000000000005',
        requirementId: '00000000-0000-4000-8000-000000000003',
        status: 'waiting',
        statusHistory: [
          {
            id: '00000000-0000-4000-8000-000000000006',
            toStatus: 'waiting',
            effectiveAt: '2026-08-24T01:00:00.000Z',
          },
        ],
      };
    });
    const api = { request } as unknown as FlowTraceApiClient;
    const server = createFlowTraceMcpServer(api);
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);

    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(37);
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'search',
        'get_project_snapshot',
        'get_project_handoff',
        'update_project_handoff',
        'get_project_handoff_history',
        'get_version_snapshot',
        'get_requirement',
        'get_person_work',
        'list_action_items',
        'get_action_item',
        'get_changes_since',
        'create_version',
        'update_version',
        'create_requirement',
        'update_requirement',
        'create_action_item',
        'update_action_item',
        'assign_owners',
        'move_requirement_to_version',
        'add_stage',
        'update_stage',
        'update_stage_status',
        'reschedule_stage',
        'report_bug',
        'update_bug_status',
        'correct_status_history',
        'reschedule_bug',
        'update_action_item_status',
        'reschedule_action_item',
        'add_dependency',
        'remove_dependency',
        'preview_changes',
        'apply_changes',
        'delete_work_item',
      ]),
    );
    expect(tools.tools.map((tool) => tool.name)).not.toContain('set_field');
    expect(tools.tools.map((tool) => tool.name)).not.toContain('list_projects');
    expect(
      tools.tools.every((tool) => (tool.description?.length ?? 0) >= 20),
    ).toBe(true);
    expect(
      tools.tools.find((tool) => tool.name === 'delete_work_item')?.annotations,
    ).toMatchObject({ destructiveHint: true, readOnlyHint: false });
    expect(
      tools.tools.find((tool) => tool.name === 'search')?.annotations,
    ).toMatchObject({ readOnlyHint: true });
    expect(
      tools.tools.find((tool) => tool.name === 'create_requirement')
        ?.description,
    ).toContain('放入需求池');
    expect(
      tools.tools.find((tool) => tool.name === 'add_stage')?.description,
    ).toContain('独立名称');
    expect(
      tools.tools.find((tool) => tool.name === 'preview_changes')?.annotations,
    ).toMatchObject({ readOnlyHint: true });
    expect(
      tools.tools.find((tool) => tool.name === 'apply_changes')?.annotations,
    ).toMatchObject({ destructiveHint: true, readOnlyHint: false });

    const search = await client.callTool({
      name: 'search',
      arguments: { query: '', types: ['project'] },
    });
    expect(search.structuredContent).toEqual({
      success: true,
      pagination: { total: 1, hasMore: false },
      data: [
        {
          type: 'project',
          id: '00000000-0000-4000-8000-000000000001',
          key: 'DEMO',
          name: '演示项目',
        },
      ],
    });
    expect(request).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/search\/page\?q=&types=project&limit=20&offset=0$/,
      ),
    );
    await client.callTool({
      name: 'search',
      arguments: {
        query: '历史人员',
        types: ['person'],
        include_inactive_people: true,
      },
    });
    expect(request).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/search\/page\?q=%E5%8E%86%E5%8F%B2%E4%BA%BA%E5%91%98&types=person&limit=20&includeInactivePeople=true&offset=0$/,
      ),
    );

    const handoff = await client.callTool({
      name: 'get_project_handoff',
      arguments: { project_id: '00000000-0000-4000-8000-000000000001' },
    });
    expect(handoff.structuredContent).toEqual({
      success: true,
      data: expect.objectContaining({ revision: 1 }),
    });
    await client.callTool({
      name: 'update_project_handoff',
      arguments: {
        project_id: '00000000-0000-4000-8000-000000000001',
        content: '先确认版本边界。',
        expected_revision: 1,
        agent_name: '验收调用方',
        agent_model: 'openai/gpt-5.6-sol',
        reason: '补充跨会话约定',
      },
    });
    expect(request).toHaveBeenCalledWith(
      '/projects/00000000-0000-4000-8000-000000000001/agent-handoff',
      {
        method: 'PUT',
        body: expect.objectContaining({
          expectedRevision: 1,
          source: 'agent',
          agentName: '验收调用方',
          agentModel: 'openai/gpt-5.6-sol',
        }),
      },
    );
    await client.callTool({
      name: 'get_project_handoff_history',
      arguments: { project_id: '00000000-0000-4000-8000-000000000001' },
    });
    expect(request).toHaveBeenCalledWith(
      '/projects/00000000-0000-4000-8000-000000000001/agent-handoff/history',
    );

    const response = await client.callTool({
      name: 'update_stage_status',
      arguments: {
        stage_id: '00000000-0000-4000-8000-000000000005',
        status: 'waiting',
        status_reason: '等待样板到货',
        agent_name: '验收调用方',
        reason: '根据晨会信息补录',
      },
    });
    expect(response.structuredContent).toEqual({
      success: true,
      entity: expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000005',
        status: 'waiting',
      }),
      history: {
        status: expect.objectContaining({ toStatus: 'waiting' }),
      },
      warnings: [
        expect.objectContaining({
          code: 'dependency_not_satisfied',
          dependency_id: '00000000-0000-4000-8000-000000000002',
        }),
      ],
    });
    expect(request).toHaveBeenCalledWith(
      '/stages/00000000-0000-4000-8000-000000000005/status',
      {
        method: 'POST',
        body: expect.objectContaining({
          source: 'agent',
          agentName: '验收调用方',
          statusReason: '等待样板到货',
          reason: '根据晨会信息补录',
        }),
      },
    );

    await client.callTool({
      name: 'correct_status_history',
      arguments: {
        history_id: '00000000-0000-4000-8000-000000000006',
        effective_at: '2026-08-23T01:00:00.000Z',
        reason: '修正邮件时间',
        agent_name: '验收调用方',
      },
    });
    expect(request).toHaveBeenCalledWith(
      '/history/status/00000000-0000-4000-8000-000000000006',
      {
        method: 'PATCH',
        body: expect.objectContaining({
          effectiveAt: '2026-08-23T01:00:00.000Z',
          reason: '修正邮件时间',
          source: 'agent',
          agentName: '验收调用方',
        }),
      },
    );

    const plannedOperations = [
      {
        operation_id: 'add-validation',
        type: 'add_stage' as const,
        target_id: '00000000-0000-4000-8000-000000000003',
        name: '独立验证',
        work_domain: 'verification' as const,
      },
      {
        operation_id: 'link-validation',
        type: 'add_dependency' as const,
        successor_type: 'stage' as const,
        successor_operation_id: 'add-validation',
        predecessor_type: 'stage' as const,
        predecessor_id: '00000000-0000-4000-8000-000000000005',
        note: '需求评审完成后开始验证',
      },
      {
        operation_id: 'supersede-old-stage',
        type: 'supersede_stage' as const,
        target_id: '00000000-0000-4000-8000-000000000005',
        replacement_operation_id: 'add-validation',
        effective_at: '2026-09-03T02:00:00.000Z',
      },
    ];
    await client.callTool({
      name: 'preview_changes',
      arguments: {
        project_id: '00000000-0000-4000-8000-000000000001',
        reason: '按评审结论重构流程',
        operations: plannedOperations,
        agent_name: '验收调用方',
      },
    });
    expect(request).toHaveBeenCalledWith('/changes/preview', {
      method: 'POST',
      body: expect.objectContaining({
        source: 'agent',
        reason: '按评审结论重构流程',
        operations: [
          expect.objectContaining({
            operationId: 'add-validation',
            targetId: '00000000-0000-4000-8000-000000000003',
            payload: expect.objectContaining({
              name: '独立验证',
              workDomain: 'verification',
            }),
          }),
          expect.objectContaining({
            operationId: 'link-validation',
            payload: expect.objectContaining({
              successorOperationId: 'add-validation',
              predecessorId: '00000000-0000-4000-8000-000000000005',
            }),
          }),
          expect.objectContaining({
            operationId: 'supersede-old-stage',
            targetId: '00000000-0000-4000-8000-000000000005',
            payload: expect.objectContaining({
              replacementOperationId: 'add-validation',
              effectiveAt: '2026-09-03T02:00:00.000Z',
            }),
          }),
        ],
      }),
    });
    await client.callTool({
      name: 'apply_changes',
      arguments: {
        project_id: '00000000-0000-4000-8000-000000000001',
        reason: '按评审结论重构流程',
        operations: plannedOperations,
        confirmation_token: 'a'.repeat(64),
        agent_name: '验收调用方',
      },
    });
    expect(request).toHaveBeenCalledWith('/changes/apply', {
      method: 'POST',
      body: expect.objectContaining({
        confirmationToken: 'a'.repeat(64),
        operations: expect.any(Array),
        source: 'agent',
      }),
    });

    await client.callTool({
      name: 'add_stage',
      arguments: {
        requirement_id: '00000000-0000-4000-8000-000000000003',
        name: '联调',
        work_domain: 'verification',
        order: 2,
        agent_name: '验收调用方',
      },
    });
    expect(request).toHaveBeenCalledWith(
      '/requirements/00000000-0000-4000-8000-000000000003/stages',
      {
        method: 'POST',
        body: expect.objectContaining({
          workDomain: 'verification',
          order: 2,
          source: 'agent',
        }),
      },
    );

    await client.callTool({
      name: 'update_stage',
      arguments: {
        stage_id: '00000000-0000-4000-8000-000000000005',
        name: '板上联调',
        note: '覆盖主从机切换场景。',
        order: 3,
        reason: '按评审结论细化真实工作',
        agent_name: '验收调用方',
      },
    });
    expect(request).toHaveBeenCalledWith(
      '/stages/00000000-0000-4000-8000-000000000005',
      {
        method: 'PATCH',
        body: expect.objectContaining({
          name: '板上联调',
          note: '覆盖主从机切换场景。',
          order: 3,
          reason: '按评审结论细化真实工作',
          source: 'agent',
          agentName: '验收调用方',
        }),
      },
    );

    await client.callTool({
      name: 'create_version',
      arguments: {
        project_id: '00000000-0000-4000-8000-000000000001',
        name: '第一批 1500 套',
        status: 'active',
        agent_name: '验收调用方',
      },
    });
    expect(request).toHaveBeenCalledWith(
      '/projects/00000000-0000-4000-8000-000000000001/versions',
      {
        method: 'POST',
        body: expect.objectContaining({
          name: '第一批 1500 套',
          status: 'active',
          source: 'agent',
        }),
      },
    );

    await client.callTool({
      name: 'update_version',
      arguments: {
        version_id: '00000000-0000-4000-8000-000000000007',
        planned_release_at: '2026-09-01T10:00:00.000Z',
        reason: '生产计划确认',
        agent_name: '验收调用方',
      },
    });
    expect(request).toHaveBeenCalledWith(
      '/versions/00000000-0000-4000-8000-000000000007',
      {
        method: 'PATCH',
        body: expect.objectContaining({
          plannedReleaseAt: '2026-09-01T10:00:00.000Z',
          reason: '生产计划确认',
        }),
      },
    );

    await client.callTool({
      name: 'delete_work_item',
      arguments: {
        target_type: 'version',
        target_id: '00000000-0000-4000-8000-000000000007',
        confirmation: '第一批 1500 套',
        reason: '空版本不再使用',
        agent_name: '验收调用方',
      },
    });
    expect(request).toHaveBeenCalledWith(
      '/versions/00000000-0000-4000-8000-000000000007',
      {
        method: 'DELETE',
        body: expect.objectContaining({
          confirmation: '第一批 1500 套',
          reason: '空版本不再使用',
          source: 'agent',
          agentName: '验收调用方',
        }),
      },
    );

    await client.callTool({
      name: 'create_requirement',
      arguments: {
        project_id: '00000000-0000-4000-8000-000000000001',
        title: '量产物料准备',
        stages: [
          {
            name: '物料报价',
            work_domain: 'implementation',
            owner_ids: ['00000000-0000-4000-8000-000000000008'],
            planned_end_at: '2026-08-28T10:00:00.000Z',
          },
          { name: '采购下单' },
        ],
        agent_name: '验收调用方',
      },
    });
    expect(request).toHaveBeenCalledWith('/requirements', {
      method: 'POST',
      body: expect.objectContaining({
        stages: [
          expect.objectContaining({
            name: '物料报价',
            workDomain: 'implementation',
            ownerIds: ['00000000-0000-4000-8000-000000000008'],
          }),
          expect.objectContaining({ name: '采购下单' }),
        ],
      }),
    });
    const latestRequirementBody = () =>
      request.mock.calls
        .filter(([path]) => path === '/requirements')
        .at(-1)?.[1]?.body;
    const omittedVersionBody = latestRequirementBody();
    expect(omittedVersionBody).not.toHaveProperty('versionId');

    for (const version_id of [null, '', '   ']) {
      await client.callTool({
        name: 'create_requirement',
        arguments: {
          project_id: '00000000-0000-4000-8000-000000000001',
          version_id,
          title: '需求池事项',
          agent_name: '验收调用方',
        },
      });
      const backlogBody = latestRequirementBody();
      expect(backlogBody).not.toHaveProperty('versionId');
    }

    const callsBeforeInvalidId = request.mock.calls.length;
    const invalidId = await client.callTool({
      name: 'update_stage_status',
      arguments: {
        stage_id: 'efb2d48-a-c379-4ccf-a048-0e9ae59db207',
        status: 'done',
        agent_name: '验收调用方',
      },
    });
    expect(invalidId.isError).toBe(true);
    expect(invalidId.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining('请逐字复制最近一次查询返回的 ID'),
        }),
      ]),
    );
    expect(request).toHaveBeenCalledTimes(callsBeforeInvalidId);

    const resources = await client.listResources();
    expect(resources.resources.map((resource) => resource.uri)).toEqual([
      'flowtrace://guide',
      'flowtrace://concepts/model',
      'flowtrace://concepts/status',
      'flowtrace://concepts/schedule',
      'flowtrace://concepts/dependency',
      'flowtrace://concepts/rework',
    ]);
    const statusResource = await client.readResource({
      uri: 'flowtrace://concepts/status',
    });
    expect(statusResource.contents[0]).toMatchObject({
      uri: 'flowtrace://concepts/status',
      mimeType: 'text/markdown',
    });
    expect(statusResource.contents[0]).toHaveProperty(
      'text',
      expect.stringContaining('等待中'),
    );

    await client.close();
    await server.close();
  });
});
