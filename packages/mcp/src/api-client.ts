import { randomUUID } from 'node:crypto';
export class FlowTraceApiClient {
  constructor(
    private readonly baseUrl = process.env.FLOWTRACE_API_URL ??
      'http://127.0.0.1:3100/api',
    private readonly authorization: Record<string, string> = process.env
      .FLOWTRACE_API_KEY
      ? { authorization: `Bearer ${process.env.FLOWTRACE_API_KEY}` }
      : {},
  ) {}

  async request<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
      body?: unknown;
    } = {},
  ): Promise<T> {
    const write = options.method && options.method !== 'GET';
    const receipt = write && !['/changes/preview', '/batch'].includes(path);
    const body =
      options.body && typeof options.body === 'object'
        ? { ...(options.body as Record<string, unknown>) }
        : options.body;
    const requestId = receipt
      ? typeof (body as Record<string, unknown> | undefined)?.requestId ===
        'string'
        ? ((body as Record<string, unknown>).requestId as string)
        : randomUUID()
      : undefined;
    if (body && typeof body === 'object')
      delete (body as Record<string, unknown>).requestId;
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          ...this.authorization,
          ...(body ? { 'content-type': 'application/json' } : {}),
          ...(receipt
            ? {
                'x-flowtrace-request-id': requestId!,
                'x-flowtrace-result': 'receipt',
              }
            : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error(
        receipt
          ? `FlowTrace 写入结果未知。执行标识 ${requestId}；先调用 get_operation_result 核验，或使用原标识和原参数重放。`
          : 'FlowTrace API 连接失败或超时',
      );
    }
    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new Error(
        receipt
          ? `FlowTrace 写入响应中断。执行标识 ${requestId}；先调用 get_operation_result 核验，或使用原标识和原参数重放。`
          : 'FlowTrace API 响应读取失败',
      );
    }
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      throw new Error(
        `FlowTrace API ${response.status}: 返回非 JSON 内容${requestId ? `；执行标识 ${requestId}，请核验写入结果` : ''}`,
      );
    }
    if (
      response.ok &&
      data &&
      typeof data === 'object' &&
      'mutation' in data &&
      'data' in data
    ) {
      const payload = data as { data: unknown; mutation: unknown };
      return {
        ...(payload.data && typeof payload.data === 'object'
          ? payload.data
          : {}),
        _mutation: payload.mutation,
      } as T;
    }
    if (!response.ok) {
      const message =
        typeof data === 'object' && data && 'message' in data
          ? JSON.stringify((data as { message: unknown }).message)
          : text || response.statusText;
      throw new Error(
        `FlowTrace API ${response.status}: ${message}${requestId ? `；执行标识 ${requestId}` : ''}`,
      );
    }
    return data as T;
  }
}
