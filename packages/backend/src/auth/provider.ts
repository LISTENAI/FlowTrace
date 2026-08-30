import type { GenericOAuthConfig } from 'better-auth/plugins';
import type { AuthProviderInfo } from '@flowtrace/shared';

export const FLOWTRACE_AUTH_PROVIDER = Symbol('FLOWTRACE_AUTH_PROVIDER');

export interface ExternalIdentity {
  issuer: string;
  subject: string;
  name: string;
  email?: string;
  emailVerified: boolean;
  image?: string;
}

export interface AuthProviderAdapter extends AuthProviderInfo {
  genericOAuthConfig(): GenericOAuthConfig;
}

export function publicAuthProviderInfo(
  provider: AuthProviderInfo,
): AuthProviderInfo {
  return {
    id: provider.id,
    name: provider.name,
    kind: provider.kind,
    nameAuthority: provider.nameAuthority,
    emailAuthority: provider.emailAuthority,
  };
}
