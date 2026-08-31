import { createHash } from 'node:crypto';
import type { GenericOAuthConfig } from 'better-auth/plugins';
import type { AuthProviderAdapter, ExternalIdentity } from '@/auth/provider';

interface WeComResponse {
  errcode?: number;
  errmsg?: string;
}

interface WeComTokenResponse extends WeComResponse {
  access_token?: string;
  expires_in?: number;
}

interface WeComLoginResponse extends WeComResponse {
  userid?: string;
  user_ticket?: string;
  expires_in?: number;
}

interface WeComProfileResponse extends WeComResponse {
  userid?: string;
  name?: string;
  email?: string;
  biz_mail?: string;
  avatar?: string;
}

export interface WeComAuthOptions {
  corpId: string;
  agentId: string;
  secret: string;
  scope?: 'snsapi_base' | 'snsapi_privateinfo';
  apiBaseUrl?: string;
  authorizeUrl?: string;
  fetch?: typeof fetch;
  now?: () => number;
}

function normalizeEmail(value?: string) {
  const email = value?.trim().toLowerCase();
  return email || undefined;
}

function assertWeComSuccess<T extends WeComResponse>(
  response: T,
  operation: string,
): T {
  if ((response.errcode ?? 0) !== 0) {
    throw new Error(
      `企业微信${operation}失败：${response.errmsg ?? response.errcode}`,
    );
  }
  return response;
}

export class WeComAuthProvider implements AuthProviderAdapter {
  readonly id = 'wecom';
  readonly name = '企业微信';
  readonly kind = 'external' as const;
  readonly nameAuthority = 'provider' as const;
  readonly emailAuthority = 'provider' as const;
  private readonly fetch: typeof fetch;
  private readonly now: () => number;
  private readonly apiBaseUrl: string;
  private readonly authorizeUrl: string;
  private accessToken?: { value: string; expiresAt: number };

  constructor(private readonly options: WeComAuthOptions) {
    this.fetch = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
    this.apiBaseUrl = options.apiBaseUrl ?? 'https://qyapi.weixin.qq.com';
    this.authorizeUrl =
      options.authorizeUrl ??
      'https://open.weixin.qq.com/connect/oauth2/authorize#wechat_redirect';
  }

  genericOAuthConfig(): GenericOAuthConfig {
    return {
      providerId: this.id,
      name: this.name,
      clientId: this.options.corpId,
      authorizationUrl: this.authorizeUrl,
      accountIssuer: `wecom:${this.options.corpId}`,
      accountSubject: ({ profile }) => profile.id ?? '',
      pkce: false,
      scopes: [this.options.scope ?? 'snsapi_privateinfo'],
      authorizationUrlParams: {
        appid: this.options.corpId,
        agentid: this.options.agentId,
      },
      getToken: async ({ code }) => {
        const identity = await this.exchangeCode(code);
        return {
          // 企微没有用户级 access token。这里只传递非敏感占位值，真正的
          // 应用 access token 只存在于本适配器的短时内存缓存中。
          accessToken: `wecom-identity:${identity.subject}`,
          raw: { identity },
        };
      },
      getUserInfo: async (tokens) => {
        const identity = (tokens.raw as { identity?: ExternalIdentity } | null)
          ?.identity;
        if (!identity) return null;
        return {
          id: identity.subject,
          name: identity.name,
          email: identity.email ?? this.syntheticEmail(identity.subject),
          emailVerified: identity.emailVerified,
          image: identity.image,
          wecomIssuer: identity.issuer,
          wecomUserId: identity.subject,
        };
      },
    };
  }

  async exchangeCode(code: string): Promise<ExternalIdentity> {
    const accessToken = await this.getAccessToken();
    const login = await this.getJson<WeComLoginResponse>(
      '/cgi-bin/auth/getuserinfo',
      { access_token: accessToken, code },
      '获取登录身份',
    );
    if (!login.userid) throw new Error('企业微信没有返回企业成员 UserId');

    const [privateProfile, directoryProfile] = await Promise.all([
      login.user_ticket
        ? this.postJson<WeComProfileResponse>(
            '/cgi-bin/auth/getuserdetail',
            { access_token: accessToken },
            { user_ticket: login.user_ticket },
            '获取成员授权资料',
          )
        : undefined,
      this.getJson<WeComProfileResponse>(
        '/cgi-bin/user/get',
        { access_token: accessToken, userid: login.userid },
        '读取成员资料',
      ).catch(() => undefined),
    ]);
    const email = normalizeEmail(
      privateProfile?.email ??
        privateProfile?.biz_mail ??
        directoryProfile?.email ??
        directoryProfile?.biz_mail,
    );
    return {
      issuer: `wecom:${this.options.corpId}`,
      subject: login.userid,
      name:
        directoryProfile?.name ??
        privateProfile?.name ??
        email?.split('@')[0] ??
        login.userid,
      email,
      emailVerified: Boolean(email),
      image: privateProfile?.avatar ?? directoryProfile?.avatar,
    };
  }

  private syntheticEmail(userId: string) {
    const digest = createHash('sha256')
      .update(`${this.options.corpId}:${userId}`)
      .digest('hex');
    return `wecom-${digest}@flowtrace.invalid`;
  }

  private async getAccessToken() {
    if (this.accessToken && this.accessToken.expiresAt > this.now() + 60_000) {
      return this.accessToken.value;
    }
    const response = await this.getJson<WeComTokenResponse>(
      '/cgi-bin/gettoken',
      { corpid: this.options.corpId, corpsecret: this.options.secret },
      '获取应用凭证',
    );
    if (!response.access_token) throw new Error('企业微信没有返回应用凭证');
    this.accessToken = {
      value: response.access_token,
      expiresAt: this.now() + (response.expires_in ?? 7200) * 1000,
    };
    return response.access_token;
  }

  private async getJson<T extends WeComResponse>(
    path: string,
    query: Record<string, string>,
    operation: string,
  ) {
    const url = new URL(path, this.apiBaseUrl);
    Object.entries(query).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    const response = await this.fetch(url, { redirect: 'error' });
    if (!response.ok)
      throw new Error(`企业微信${operation}失败：HTTP ${response.status}`);
    return assertWeComSuccess((await response.json()) as T, operation);
  }

  private async postJson<T extends WeComResponse>(
    path: string,
    query: Record<string, string>,
    body: unknown,
    operation: string,
  ) {
    const url = new URL(path, this.apiBaseUrl);
    Object.entries(query).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    const response = await this.fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok)
      throw new Error(`企业微信${operation}失败：HTTP ${response.status}`);
    return assertWeComSuccess((await response.json()) as T, operation);
  }
}
