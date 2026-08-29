import type { fromNodeHeaders } from 'better-auth/node';
import type { getAuthRuntime } from '@/auth/auth-runtime';
import type { CurrentIdentity } from '@flowtrace/shared';

type Runtime = NonNullable<ReturnType<typeof getAuthRuntime>>;

export type FlowTraceSession = NonNullable<
  Awaited<ReturnType<Runtime['auth']['api']['getSession']>>
>;

export interface AuthenticatedRequest {
  headers: Parameters<typeof fromNodeHeaders>[0];
  flowTraceSession?: FlowTraceSession;
  flowTraceIdentity?: CurrentIdentity;
}
