import { describe, expect, it, vi } from 'vitest';
import { WeComAuthProvider } from '@/auth/wecom-auth-provider';
import { publicAuthProviderInfo } from '@/auth/provider';

describe('WeComAuthProvider', () => {
  it('only exposes public provider metadata to API consumers', () => {
    const provider = new WeComAuthProvider({
      corpId: 'ww-example',
      agentId: '1000001',
      secret: 'must-not-leak',
    });

    expect(publicAuthProviderInfo(provider)).toEqual({
      id: 'wecom',
      name: '企业微信',
      kind: 'external',
      nameAuthority: 'provider',
      emailAuthority: 'provider',
    });
    expect(JSON.stringify(publicAuthProviderInfo(provider))).not.toContain(
      'must-not-leak',
    );
  });

  it('exchanges a WeCom code without exposing the application token', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const payload = url.pathname.endsWith('/gettoken')
        ? {
            errcode: 0,
            access_token: 'application-secret-token',
            expires_in: 7200,
          }
        : url.pathname.endsWith('/auth/getuserinfo')
          ? { errcode: 0, userid: 'zhangsan', user_ticket: 'ticket' }
          : url.pathname.endsWith('/auth/getuserdetail')
            ? {
                errcode: 0,
                email: 'ZhangSan@example.com',
                avatar: 'avatar.png',
              }
            : { errcode: 0, userid: 'zhangsan', name: '张三' };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const provider = new WeComAuthProvider({
      corpId: 'corp-id',
      agentId: '10001',
      secret: 'application-secret',
      apiBaseUrl: 'https://wecom.example.test',
      fetch: fetchMock as typeof fetch,
    });

    const identity = await provider.exchangeCode('login-code');
    expect(identity).toMatchObject({
      issuer: 'wecom:corp-id',
      subject: 'zhangsan',
      name: '张三',
      email: 'zhangsan@example.com',
      emailVerified: true,
    });

    const config = provider.genericOAuthConfig();
    const tokens = await config.getToken!({
      code: 'second-code',
      redirectURI: 'https://flowtrace.example.test/api/auth/callback/wecom',
    });
    expect(tokens.accessToken).toBe('wecom-identity:zhangsan');
    expect(JSON.stringify(tokens)).not.toContain('application-secret-token');
    expect(
      fetchMock.mock.calls.filter(([value]) =>
        String(value).includes('/cgi-bin/gettoken'),
      ),
    ).toHaveLength(1);
  });

  it('does not hide failures while reading explicitly authorized profile fields', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const payload = url.pathname.endsWith('/gettoken')
        ? { errcode: 0, access_token: 'application-secret-token' }
        : url.pathname.endsWith('/auth/getuserinfo')
          ? { errcode: 0, userid: 'zhangsan', user_ticket: 'ticket' }
          : url.pathname.endsWith('/auth/getuserdetail')
            ? { errcode: 50001, errmsg: 'redirect uri invalid' }
            : { errcode: 0, userid: 'zhangsan', name: '张三' };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const provider = new WeComAuthProvider({
      corpId: 'corp-id',
      agentId: '10001',
      secret: 'application-secret',
      apiBaseUrl: 'https://wecom.example.test',
      fetch: fetchMock as typeof fetch,
    });

    await expect(provider.exchangeCode('login-code')).rejects.toThrow(
      '企业微信获取成员授权资料失败：redirect uri invalid',
    );
  });
});
