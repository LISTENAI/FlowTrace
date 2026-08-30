import { describe, expect, it } from 'vitest';
import { resolveAuthBaseURL } from '@/auth/auth-runtime';

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
