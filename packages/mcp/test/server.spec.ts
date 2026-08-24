import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';
import type { FlowTraceApiClient } from '../src/api-client.js';
import { createFlowTraceMcpServer } from '../src/server.js';

describe('FlowTrace MCP Server', () => {
  it('exposes business-semantic tools and maps Agent source fields', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ id: 'stage-1', status: 'waiting' });
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
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'get_version_snapshot',
        'list_people',
        'create_requirement',
        'assign_owners',
        'update_stage_status',
        'report_bug',
        'get_changes_since',
      ]),
    );
    expect(tools.tools.map((tool) => tool.name)).not.toContain('set_field');

    const response = await client.callTool({
      name: 'update_stage_status',
      arguments: {
        stage_id: 'stage-1',
        status: 'waiting',
        status_reason: '等待样板到货',
        agent_name: '验收 Agent',
        reason: '根据晨会信息补录',
      },
    });
    expect(response.structuredContent).toEqual({
      result: { id: 'stage-1', status: 'waiting' },
    });
    expect(request).toHaveBeenCalledWith('/stages/stage-1/status', {
      method: 'POST',
      body: expect.objectContaining({
        source: 'agent',
        agentName: '验收 Agent',
        statusReason: '等待样板到货',
        reason: '根据晨会信息补录',
      }),
    });

    await client.callTool({
      name: 'update_stage_status',
      arguments: {
        stage_id: 'stage-1',
        status: 'done',
        actual_start_at: '2026-08-20T01:00:00.000Z',
        actual_end_at: '2026-08-21T10:00:00.000Z',
        agent_name: '验收 Agent',
      },
    });
    expect(request).toHaveBeenLastCalledWith('/stages/stage-1/status', {
      method: 'POST',
      body: expect.objectContaining({
        actualStartAt: '2026-08-20T01:00:00.000Z',
        actualEndAt: '2026-08-21T10:00:00.000Z',
        source: 'agent',
        agentName: '验收 Agent',
      }),
    });

    await client.callTool({
      name: 'assign_owners',
      arguments: {
        target_type: 'stage',
        target_id: 'stage-1',
        owner_ids: ['person-1', 'person-2'],
        agent_name: '验收 Agent',
        reason: '按项目分工更新',
      },
    });
    expect(request).toHaveBeenLastCalledWith('/stages/stage-1', {
      method: 'PATCH',
      body: {
        ownerIds: ['person-1', 'person-2'],
        source: 'agent',
        agentName: '验收 Agent',
        reason: '按项目分工更新',
      },
    });

    await client.close();
    await server.close();
  });
});
