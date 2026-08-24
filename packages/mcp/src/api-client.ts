export class FlowTraceApiClient {
  constructor(
    private readonly baseUrl = process.env.FLOWTRACE_API_URL ??
      'http://127.0.0.1:3100/api',
  ) {}

  async request<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
      body?: unknown;
    } = {},
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: options.body
        ? { 'content-type': 'application/json' }
        : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    const data = text ? (JSON.parse(text) as unknown) : undefined;
    if (!response.ok) {
      const message =
        typeof data === 'object' && data && 'message' in data
          ? JSON.stringify((data as { message: unknown }).message)
          : text || response.statusText;
      throw new Error(`FlowTrace API ${response.status}: ${message}`);
    }
    return data as T;
  }
}
