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
        'create_requirement',
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

    await client.close();
    await server.close();
  });
});
