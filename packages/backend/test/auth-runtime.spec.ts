import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import {
  createFlowTraceAuth,
  resolveAuthBaseURL,
  resolveAuthIPAddress,
} from '@/auth/auth-runtime';

const createDynamicAuth = () => {
  const pool = new Pool({
    connectionString: 'postgres://flowtrace:flowtrace@127.0.0.1:1/flowtrace',
    connectionTimeoutMillis: 50,
  });
  const auth = createFlowTraceAuth({
    secret: 'test-secret-that-is-at-least-32-characters',
    baseURL: {
      allowedHosts: ['flowtrace.example.com'],
      protocol: 'https',
    },
    pool,
    provider: {
      id: 'local',
      name: '本地账号',
      kind: 'local',
      nameAuthority: 'flowtrace',
      emailAuthority: 'account',
    },
  });
  return { auth, pool };
};

describe('resolveAuthBaseURL', () => {
  it('uses one canonical URL for a single-domain deployment', () => {
    expect(
      resolveAuthBaseURL({
        FLOWTRACE_AUTH_BASE_URL: 'https://flowtrace.example.com',
      }),
    ).toBe('https://flowtrace.example.com');
  });

  it('allows one deployment to serve an explicit host allowlist', () => {
    expect(
      resolveAuthBaseURL({
        FLOWTRACE_AUTH_ALLOWED_HOSTS:
          'staging.example.com, flowtrace.example.com',
        FLOWTRACE_AUTH_PROTOCOL: 'https',
      }),
    ).toEqual({
      allowedHosts: ['staging.example.com', 'flowtrace.example.com'],
      protocol: 'https',
    });
  });

  it('rejects ambiguous static and dynamic configuration', () => {
    expect(() =>
      resolveAuthBaseURL({
        FLOWTRACE_AUTH_BASE_URL: 'https://flowtrace.example.com',
        FLOWTRACE_AUTH_ALLOWED_HOSTS: 'flowtrace.example.com',
      }),
    ).toThrow('只能配置一个');
  });

  it('rejects an unknown protocol', () => {
    expect(() =>
      resolveAuthBaseURL({
        FLOWTRACE_AUTH_ALLOWED_HOSTS: 'flowtrace.example.com',
        FLOWTRACE_AUTH_PROTOCOL: 'ftp',
      }),
    ).toThrow('必须是 http、https 或 auto');
  });
});

describe('dynamic auth request host', () => {
  it('accepts an allowed forwarded host for an internal request', async () => {
    const { auth, pool } = createDynamicAuth();

    try {
      await expect(
        auth.api.getSession({
          headers: new Headers({
            host: '127.0.0.1',
            'x-forwarded-host': 'flowtrace.example.com',
          }),
        }),
      ).resolves.toBeNull();
    } finally {
      await pool.end();
    }
  });

  it('still rejects a forwarded host outside the allowlist', async () => {
    const { auth, pool } = createDynamicAuth();

    try {
      await expect(
        auth.api.getSession({
          headers: new Headers({
            host: '127.0.0.1',
            'x-forwarded-host': 'attacker.example.com',
          }),
        }),
      ).rejects.toThrow('not in the allowed hosts list');
    } finally {
      await pool.end();
    }
  });
});

describe('resolveAuthIPAddress', () => {
  it('uses explicit proxy headers and trusted proxy ranges', () => {
    expect(
      resolveAuthIPAddress({
        FLOWTRACE_AUTH_IP_HEADERS: 'x-real-ip, x-forwarded-for',
        FLOWTRACE_AUTH_TRUSTED_PROXIES: '192.0.2.10, 10.0.0.0/24',
      }),
    ).toEqual({
      ipAddressHeaders: ['x-real-ip', 'x-forwarded-for'],
      trustedProxies: ['192.0.2.10', '10.0.0.0/24'],
    });
  });

  it('keeps Better Auth defaults when no proxy policy is configured', () => {
    expect(resolveAuthIPAddress({})).toBeUndefined();
  });
});
