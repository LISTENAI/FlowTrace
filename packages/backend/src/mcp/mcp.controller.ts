import { All, Body, Controller, Req, Res } from '@nestjs/common';
import { handleFlowTraceMcpRequest } from '@flowtrace/mcp/http';
import type { IncomingMessage, ServerResponse } from 'node:http';

@Controller('mcp')
export class McpController {
  @All()
  handle(
    @Req() request: IncomingMessage,
    @Res() response: ServerResponse,
    @Body() body: unknown,
  ) {
    const port = process.env.FLOWTRACE_PORT ?? '3100';
    const configuredApiBaseUrl = process.env.FLOWTRACE_API_URL;
    const apiHeaders: Record<string, string> = {};
    const authorization = request.headers.authorization;
    const apiKey = request.headers['x-api-key'];
    if (authorization) apiHeaders.authorization = authorization;
    if (typeof apiKey === 'string') apiHeaders['x-api-key'] = apiKey;
    if (!configuredApiBaseUrl && request.headers.host) {
      apiHeaders['x-forwarded-host'] = request.headers.host;
    }
    return handleFlowTraceMcpRequest(request, response, body, {
      apiBaseUrl: configuredApiBaseUrl ?? `http://127.0.0.1:${port}/api`,
      apiHeaders,
    });
  }
}
