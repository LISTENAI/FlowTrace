import { createAuthClient } from 'better-auth/vue';
import type { CurrentIdentity } from '@flowtrace/shared';

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: '/api/auth',
});

export async function currentIdentity(): Promise<CurrentIdentity> {
  const response = await fetch('/api/me');
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as
      { message?: string | string[] } | undefined;
    const message = Array.isArray(payload?.message)
      ? payload.message.join('；')
      : payload?.message;
    throw new IdentityProvisioningError(
      message ?? '无法确认当前登录身份',
      response.status,
    );
  }
  return response.json() as Promise<CurrentIdentity>;
}

export class IdentityProvisioningError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'IdentityProvisioningError';
  }
}
