import { apiKey } from '@better-auth/api-key';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { genericOAuth } from 'better-auth/plugins';
import { Pool } from 'pg';
import type { AuthProviderInfo } from '@flowtrace/shared';
import { OidcAuthProvider } from '@/auth/oidc-auth-provider';
import type { AuthProviderAdapter } from '@/auth/provider';
import { WeComAuthProvider } from '@/auth/wecom-auth-provider';
import { postgresPoolConfig } from '@/database/config';

export interface FlowTraceAuthRuntime {
  auth: FlowTraceAuth;
  pool: Pool;
  provider: AuthProviderInfo;
  setupRequired(): Promise<boolean>;
}

export interface FlowTraceAuthOptions {
  secret: string;
  baseURL: string;
  pool: Pool;
  provider: AuthProviderInfo;
  oauthProvider?: AuthProviderAdapter;
  trustedOrigins?: string[];
}

export function createFlowTraceAuth(options: FlowTraceAuthOptions) {
  const providerConfigs = options.oauthProvider
    ? [options.oauthProvider.genericOAuthConfig()]
    : [];
  return betterAuth({
    appName: 'FlowTrace',
    baseURL: options.baseURL,
    secret: options.secret,
    trustedOrigins: options.trustedOrigins,
    database: options.pool,
    emailAndPassword: { enabled: options.provider.kind === 'local' },
    user: {
      modelName: 'auth_user',
      additionalFields: {
        localOwner: {
          type: 'boolean',
          required: false,
          input: false,
          returned: false,
          defaultValue: options.provider.kind === 'local',
        },
      },
    },
    session: { modelName: 'auth_session' },
    account: {
      modelName: 'auth_account',
      updateAccountOnSignIn: false,
      accountLinking: { disableImplicitLinking: true },
    },
    verification: { modelName: 'auth_verification' },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (
          options.provider.kind !== 'local' ||
          context.path !== '/sign-up/email'
        ) {
          return;
        }
        const existing = await options.pool.query(
          'SELECT 1 FROM "auth_user" WHERE "localOwner" = true LIMIT 1',
        );
        if (existing.rowCount) {
          throw new APIError('FORBIDDEN', {
            message: '实例初始化已经完成，不能继续创建本地账号',
          });
        }
      }),
    },
    databaseHooks: {
      account: {
        create: {
          before: async (account) => {
            const data = { ...account };
            delete data.accessToken;
            delete data.refreshToken;
            delete data.idToken;
            return { data };
          },
        },
        update: {
          before: async (account) => {
            const data = { ...account };
            delete data.accessToken;
            delete data.refreshToken;
            delete data.idToken;
            return { data };
          },
        },
      },
    },
    plugins: [
      ...(providerConfigs.length
        ? [genericOAuth({ config: providerConfigs })]
        : []),
      apiKey({
        enableSessionForAPIKeys: true,
        defaultPrefix: 'ft_',
        rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 1000 },
        schema: { apikey: { modelName: 'auth_api_key' } },
        customAPIKeyGetter: (context) => {
          const direct = context.headers?.get('x-api-key');
          if (direct) return direct;
          const authorization = context.headers?.get('authorization');
          return authorization?.startsWith('Bearer ')
            ? authorization.slice('Bearer '.length).trim()
            : null;
        },
      }),
    ],
  });
}

export type FlowTraceAuth = ReturnType<typeof createFlowTraceAuth>;

let runtime: FlowTraceAuthRuntime | undefined;

const localProvider: AuthProviderInfo = {
  id: 'local',
  name: '本地账号',
  kind: 'local',
  nameAuthority: 'flowtrace',
  emailAuthority: 'account',
};

export function getAuthRuntime(): FlowTraceAuthRuntime {
  if (runtime) return runtime;

  const secret = process.env.FLOWTRACE_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('FLOWTRACE_AUTH_SECRET 必须至少为 32 个字符');
  }
  const baseURL = process.env.FLOWTRACE_AUTH_BASE_URL;
  if (!baseURL) throw new Error('必须配置 FLOWTRACE_AUTH_BASE_URL');

  const providerId = process.env.FLOWTRACE_AUTH_PROVIDER;
  let provider: AuthProviderInfo;
  let oauthProvider: AuthProviderAdapter | undefined;
  if (providerId === 'local') {
    provider = localProvider;
  } else if (providerId === 'wecom') {
    const corpId = process.env.FLOWTRACE_WECOM_CORP_ID;
    const agentId = process.env.FLOWTRACE_WECOM_AGENT_ID;
    const wecomSecret = process.env.FLOWTRACE_WECOM_SECRET;
    if (!corpId || !agentId || !wecomSecret) {
      throw new Error(
        '企业微信认证必须同时配置 FLOWTRACE_WECOM_CORP_ID、FLOWTRACE_WECOM_AGENT_ID 和 FLOWTRACE_WECOM_SECRET',
      );
    }
    oauthProvider = new WeComAuthProvider({
      corpId,
      agentId,
      secret: wecomSecret,
      scope:
        process.env.FLOWTRACE_WECOM_SCOPE === 'snsapi_base'
          ? 'snsapi_base'
          : 'snsapi_privateinfo',
    });
    provider = oauthProvider;
  } else if (providerId === 'oidc') {
    const issuer = process.env.FLOWTRACE_OIDC_ISSUER;
    const clientId = process.env.FLOWTRACE_OIDC_CLIENT_ID;
    const clientSecret = process.env.FLOWTRACE_OIDC_CLIENT_SECRET;
    if (!issuer || !clientId || !clientSecret) {
      throw new Error(
        'OIDC 认证必须同时配置 FLOWTRACE_OIDC_ISSUER、FLOWTRACE_OIDC_CLIENT_ID 和 FLOWTRACE_OIDC_CLIENT_SECRET',
      );
    }
    oauthProvider = new OidcAuthProvider({
      issuer,
      clientId,
      clientSecret,
      name: process.env.FLOWTRACE_OIDC_NAME,
    });
    provider = oauthProvider;
  } else {
    throw new Error(
      'FLOWTRACE_AUTH_PROVIDER 必须明确设置为 local、oidc 或 wecom',
    );
  }

  const pool = new Pool(postgresPoolConfig());
  runtime = {
    auth: createFlowTraceAuth({
      secret,
      baseURL,
      pool,
      provider,
      oauthProvider,
      trustedOrigins: process.env.FLOWTRACE_AUTH_TRUSTED_ORIGINS?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    }),
    pool,
    provider,
    async setupRequired() {
      if (provider.kind !== 'local') return false;
      const result = await pool.query(
        'SELECT 1 FROM "auth_user" WHERE "localOwner" = true LIMIT 1',
      );
      return !result.rowCount;
    },
  };
  return runtime!;
}
