import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';
import type { FlowTraceApiClient } from '../src/api-client.js';
import { createFlowTraceMcpServer } from '../src/server.js';

describe('FlowTrace MCP Server', () => {
  it('provides a self-describing bounded catalog, resources and audited writes', async () => {
    const request = vi.fn(async (path: string) => {
      if (path.startsWith('/search?')) {
        return [
          {
            type: 'project',
            id: 'project-1',
            key: 'DEMO',
            name: '演示项目',
          },
        ];
      }
      if (path.startsWith('/dependencies?')) {
        return [
          {
            id: 'dependency-1',
            active: true,
            satisfied: false,
            successor: { requirementId: 'requirement-1' },
            predecessor: { projectName: '前置项目', name: '准备样件' },
          },
        ];
      }
      return {
        id: 'stage-1',
        requirementId: 'requirement-1',
        status: 'waiting',
        statusHistory: [
          {
            id: 'status-1',
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
    expect(tools.tools).toHaveLength(19);
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'search',
        'get_project_snapshot',
        'get_version_snapshot',
        'get_requirement',
        'get_changes_since',
        'create_requirement',
        'update_requirement',
        'assign_owners',
        'move_requirement_to_version',
        'add_stage',
        'update_stage_status',
        'reschedule_stage',
        'report_bug',
        'update_bug_status',
        'correct_status_history',
        'reschedule_bug',
        'add_dependency',
        'remove_dependency',
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

    const search = await client.callTool({
      name: 'search',
      arguments: { query: '', types: ['project'] },
    });
    expect(search.structuredContent).toEqual({
      success: true,
      data: [
        {
          type: 'project',
          id: 'project-1',
          key: 'DEMO',
          name: '演示项目',
        },
      ],
    });
    expect(request).toHaveBeenCalledWith(
      expect.stringMatching(/^\/search\?q=&types=project&limit=20$/),
    );

    const response = await client.callTool({
      name: 'update_stage_status',
      arguments: {
        stage_id: 'stage-1',
        status: 'waiting',
        status_reason: '等待样板到货',
        agent_name: '验收调用方',
        reason: '根据晨会信息补录',
      },
    });
    expect(response.structuredContent).toEqual({
      success: true,
      entity: expect.objectContaining({
        id: 'stage-1',
        status: 'waiting',
      }),
      history: {
        status: expect.objectContaining({ toStatus: 'waiting' }),
      },
      warnings: [
        expect.objectContaining({
          code: 'dependency_not_satisfied',
          dependency_id: 'dependency-1',
        }),
      ],
    });
    expect(request).toHaveBeenCalledWith('/stages/stage-1/status', {
      method: 'POST',
      body: expect.objectContaining({
        source: 'agent',
        agentName: '验收调用方',
        statusReason: '等待样板到货',
        reason: '根据晨会信息补录',
      }),
    });

    await client.callTool({
      name: 'correct_status_history',
      arguments: {
        history_id: 'status-1',
        effective_at: '2026-08-23T01:00:00.000Z',
        reason: '修正邮件时间',
        agent_name: '验收调用方',
      },
    });
    expect(request).toHaveBeenCalledWith('/history/status/status-1', {
      method: 'PATCH',
      body: expect.objectContaining({
        effectiveAt: '2026-08-23T01:00:00.000Z',
        reason: '修正邮件时间',
        source: 'agent',
        agentName: '验收调用方',
      }),
    });

    await client.callTool({
      name: 'add_stage',
      arguments: {
        requirement_id: 'requirement-1',
        name: '联调',
        order: 2,
        agent_name: '验收调用方',
      },
    });
    expect(request).toHaveBeenCalledWith('/requirements/requirement-1/stages', {
      method: 'POST',
      body: expect.objectContaining({ order: 2, source: 'agent' }),
    });

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
