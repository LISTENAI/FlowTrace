export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = (await response.json().catch(() => undefined)) as
    { message?: string | string[] } | undefined;
  if (!response.ok) {
    if (response.status === 401 && window.location.pathname !== '/login') {
      const redirect = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.assign(`/login?redirect=${encodeURIComponent(redirect)}`);
    }
    const message = Array.isArray(payload?.message)
      ? payload.message.join('；')
      : payload?.message;
    throw new ApiError(message ?? '请求未能完成', response.status);
  }
  return payload as T;
}
