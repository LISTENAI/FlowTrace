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
    return handleFlowTraceMcpRequest(request, response, body, {
      apiBaseUrl:
        process.env.FLOWTRACE_API_URL ?? `http://127.0.0.1:${port}/api`,
    });
  }
}
