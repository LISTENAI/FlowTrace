import { apiKey } from '@better-auth/api-key';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { genericOAuth } from 'better-auth/plugins';
import { Pool } from 'pg';
import type { AuthProviderInfo } from '@flowtrace/shared';
import { OidcAuthProvider } from '@/auth/oidc-auth-provider';
import {
  publicAuthProviderInfo,
  type AuthProviderAdapter,
} from '@/auth/provider';
import { WeComAuthProvider } from '@/auth/wecom-auth-provider';
import { postgresPoolConfig } from '@/database/config';

export interface FlowTraceAuthRuntime {
  auth: FlowTraceAuth;
  pool: Pool;
  provider: AuthProviderInfo;
  setupRequired(): Promise<boolean>;
}

type AuthBaseURL =
  | string
  | {
      allowedHosts: string[];
      protocol: 'http' | 'https' | 'auto';
      fallback?: string;
    };

export interface FlowTraceAuthOptions {
  secret: string;
  baseURL: AuthBaseURL;
  pool: Pool;
  provider: AuthProviderInfo;
  oauthProvider?: AuthProviderAdapter;
  trustedOrigins?: string[];
  ipAddress?: {
    ipAddressHeaders?: string[];
    trustedProxies?: string[];
  };
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
    advanced: options.ipAddress ? { ipAddress: options.ipAddress } : undefined,
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

export function resolveAuthBaseURL(
  environment: NodeJS.ProcessEnv = process.env,
): AuthBaseURL {
  const staticURL = environment.FLOWTRACE_AUTH_BASE_URL?.trim();
  const allowedHosts = environment.FLOWTRACE_AUTH_ALLOWED_HOSTS?.split(',')
    .map((host) => host.trim())
    .filter(Boolean);
  if (staticURL && allowedHosts?.length) {
    throw new Error(
      'FLOWTRACE_AUTH_BASE_URL 与 FLOWTRACE_AUTH_ALLOWED_HOSTS 只能配置一个',
    );
  }
  if (staticURL) return staticURL;
  if (!allowedHosts?.length) {
    throw new Error(
      '必须配置 FLOWTRACE_AUTH_BASE_URL 或 FLOWTRACE_AUTH_ALLOWED_HOSTS',
    );
  }

  const protocol = environment.FLOWTRACE_AUTH_PROTOCOL?.trim() || 'https';
  if (protocol !== 'http' && protocol !== 'https' && protocol !== 'auto') {
    throw new Error('FLOWTRACE_AUTH_PROTOCOL 必须是 http、https 或 auto');
  }
  const fallback = environment.FLOWTRACE_AUTH_FALLBACK_URL?.trim();
  return {
    allowedHosts,
    protocol,
    ...(fallback ? { fallback } : {}),
  };
}

function commaSeparated(value?: string) {
  return value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function resolveAuthIPAddress(
  environment: NodeJS.ProcessEnv = process.env,
): FlowTraceAuthOptions['ipAddress'] {
  const ipAddressHeaders = commaSeparated(
    environment.FLOWTRACE_AUTH_IP_HEADERS,
  );
  const trustedProxies = commaSeparated(
    environment.FLOWTRACE_AUTH_TRUSTED_PROXIES,
  );
  if (!ipAddressHeaders?.length && !trustedProxies?.length) return undefined;
  return {
    ...(ipAddressHeaders?.length ? { ipAddressHeaders } : {}),
    ...(trustedProxies?.length ? { trustedProxies } : {}),
  };
}

export function getAuthRuntime(): FlowTraceAuthRuntime {
  if (runtime) return runtime;

  const secret = process.env.FLOWTRACE_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('FLOWTRACE_AUTH_SECRET 必须至少为 32 个字符');
  }
  const baseURL = resolveAuthBaseURL();

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
    provider = publicAuthProviderInfo(oauthProvider);
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
    provider = publicAuthProviderInfo(oauthProvider);
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
      ipAddress: resolveAuthIPAddress(),
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
