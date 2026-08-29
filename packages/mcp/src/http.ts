import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { FlowTraceApiClient } from './api-client.js';
import { createFlowTraceMcpServer } from './server.js';

export interface FlowTraceMcpHttpOptions {
  apiBaseUrl?: string;
  apiHeaders?: Record<string, string>;
  allowedHosts?: string[];
}

const methodNotAllowed = (response: ServerResponse) => {
  response.statusCode = 405;
  response.setHeader('allow', 'POST');
  response.setHeader('content-type', 'application/json');
  response.end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: '该 MCP Endpoint 仅支持 POST。' },
      id: null,
    }),
  );
};

export async function handleFlowTraceMcpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  body: unknown,
  options: FlowTraceMcpHttpOptions = {},
): Promise<void> {
  if (request.method !== 'POST') {
    methodNotAllowed(response);
    return;
  }

  const configuredHosts =
    options.allowedHosts ??
    process.env.FLOWTRACE_MCP_ALLOWED_HOSTS?.split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    ...(configuredHosts?.length
      ? {
          allowedHosts: configuredHosts,
          enableDnsRebindingProtection: true,
        }
      : {}),
  });
  const server = createFlowTraceMcpServer(
    new FlowTraceApiClient(options.apiBaseUrl, options.apiHeaders),
  );
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    void Promise.allSettled([transport.close(), server.close()]);
  };
  response.once('close', close);

  try {
    await server.connect(transport);
    await transport.handleRequest(request, response, body);
  } catch (error) {
    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: '处理 MCP 请求时发生内部错误。',
          },
          id: null,
        }),
      );
    }
    throw error;
  } finally {
    if (response.writableEnded) close();
  }
}
