import type { GenericOAuthConfig } from 'better-auth/plugins';
import type { AuthProviderAdapter } from '@/auth/provider';

export interface OidcAuthOptions {
  issuer: string;
  clientId: string;
  clientSecret: string;
  name?: string;
}

export class OidcAuthProvider implements AuthProviderAdapter {
  readonly id = 'oidc';
  readonly name: string;
  readonly kind = 'external' as const;
  readonly nameAuthority = 'provider' as const;
  readonly emailAuthority = 'provider' as const;

  constructor(private readonly options: OidcAuthOptions) {
    this.name = options.name?.trim() || '企业账号';
  }

  genericOAuthConfig(): GenericOAuthConfig {
    const issuer = this.options.issuer.replace(/\/$/, '');
    return {
      providerId: this.id,
      name: this.name,
      clientId: this.options.clientId,
      clientSecret: this.options.clientSecret,
      discoveryUrl: `${issuer}/.well-known/openid-configuration`,
      accountIssuer: issuer,
      requireIdTokenVerification: true,
      scopes: ['openid', 'profile', 'email'],
      pkce: true,
    };
  }
}
