import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { handleFlowTraceMcpRequest } = vi.hoisted(() => ({
  handleFlowTraceMcpRequest: vi.fn(),
}));

vi.mock('@flowtrace/mcp/http', () => ({ handleFlowTraceMcpRequest }));

import { McpController } from '@/mcp/mcp.controller';

describe('McpController', () => {
  const originalApiUrl = process.env.FLOWTRACE_API_URL;
  const originalPort = process.env.FLOWTRACE_PORT;

  afterEach(() => {
    handleFlowTraceMcpRequest.mockReset();
    if (originalApiUrl === undefined) delete process.env.FLOWTRACE_API_URL;
    else process.env.FLOWTRACE_API_URL = originalApiUrl;
    if (originalPort === undefined) delete process.env.FLOWTRACE_PORT;
    else process.env.FLOWTRACE_PORT = originalPort;
  });

  it('preserves the public host for the embedded loopback API request', () => {
    delete process.env.FLOWTRACE_API_URL;
    process.env.FLOWTRACE_PORT = '3100';
    const request = {
      headers: {
        host: 'flowtrace.example.com',
        authorization: 'Bearer ft_example',
      },
    } as unknown as IncomingMessage;
    const response = {} as ServerResponse;
    const body = { method: 'tools/call' };

    new McpController().handle(request, response, body);

    expect(handleFlowTraceMcpRequest).toHaveBeenCalledWith(
      request,
      response,
      body,
      {
        apiBaseUrl: 'http://127.0.0.1:3100/api',
        apiHeaders: {
          'x-forwarded-host': 'flowtrace.example.com',
          authorization: 'Bearer ft_example',
        },
      },
    );
  });

  it('does not override the host of a separately configured API', () => {
    process.env.FLOWTRACE_API_URL = 'https://api.example.com/api';
    const request = {
      headers: {
        host: 'mcp.example.com',
        'x-api-key': 'ft_example',
      },
    } as unknown as IncomingMessage;
    const response = {} as ServerResponse;
    const body = { method: 'tools/call' };

    new McpController().handle(request, response, body);

    expect(handleFlowTraceMcpRequest).toHaveBeenCalledWith(
      request,
      response,
      body,
      {
        apiBaseUrl: 'https://api.example.com/api',
        apiHeaders: { 'x-api-key': 'ft_example' },
      },
    );
  });
});
