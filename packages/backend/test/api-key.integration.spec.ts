import 'reflect-metadata';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { createFlowTraceAuth } from '@/auth/auth-runtime';
import { createTestDataSource } from './support/database';

describe.runIf(Boolean(process.env.FLOWTRACE_TEST_DATABASE_URL))(
  'personal API key names',
  () => {
    it('creates and renames a key through authenticated HTTP without rotating it, and protects ownership', async () => {
      const source = await createTestDataSource();
      const pool = new Pool({
        connectionString: process.env.FLOWTRACE_TEST_DATABASE_URL,
        options: `-c search_path=${'schema' in source.options ? source.options.schema : ''},public`,
      });
      const auth = createFlowTraceAuth({
        pool,
        baseURL: 'http://localhost:3100',
        secret: 'isolated-api-key-test-secret-at-least-32-characters',
        provider: {
          id: 'local',
          name: '本地账号',
          kind: 'local',
          nameAuthority: 'flowtrace',
          emailAuthority: 'account',
        },
      });
      try {
        const signup = await auth.api.signUpEmail({
          body: {
            email: 'key-owner@example.com',
            name: '测试用户',
            password: 'isolated-test-password',
          },
          returnHeaders: true,
        });
        const cookie = signup.headers
          .getSetCookie()
          .map((value) => value.split(';')[0])
          .join('; ');
        const call = (path: string, body?: unknown, authenticated = true) =>
          auth.handler(
            new Request(`http://localhost:3100/api/auth/api-key/${path}`, {
              method: body ? 'POST' : 'GET',
              headers: {
                ...(authenticated ? { cookie } : {}),
                origin: 'http://localhost:3100',
                ...(body ? { 'content-type': 'application/json' } : {}),
              },
              body: body ? JSON.stringify(body) : undefined,
            }),
          );
        const created = await call('create', { name: 'Codex 工作电脑' });
        expect(created.status).toBe(200);
        const key = await created.json();
        const original = await source.query(
          'SELECT "key" FROM "auth_api_key" WHERE "id" = $1',
          [key.id],
        );
        expect(
          (await call('update', { keyId: key.id, name: 'OpenClaw 项目助手' }))
            .status,
        ).toBe(200);
        const list = await (await call('list')).json();
        expect(
          list.apiKeys.find((item: { id: string }) => item.id === key.id)?.name,
        ).toBe('OpenClaw 项目助手');
        expect(list.apiKeys[0].key).toBeUndefined();
        expect(
          await source.query(
            'SELECT "key" FROM "auth_api_key" WHERE "id" = $1',
            [key.id],
          ),
        ).toEqual(original);
        expect(
          (await call('update', { keyId: key.id, name: '未登录改名' }, false))
            .status,
        ).toBe(401);
        const context = await auth.$context;
        const other = await context.internalAdapter.createUser(
          {
            name: '其他用户',
            email: 'other-key-owner@example.com',
            emailVerified: true,
            localOwner: false,
          },
          { method: 'email-password' },
        );
        const foreign = await auth.api.createApiKey({
          body: { userId: other.id, name: '其他用户的密钥' },
        });
        expect(
          (await call('update', { keyId: foreign.id, name: '越权改名' }))
            .status,
        ).toBe(404);
        expect(
          (await call('update', { keyId: key.id, name: '长'.repeat(33) }))
            .status,
        ).toBe(400);
        expect((await call('delete', { keyId: key.id })).status).toBe(200);
      } finally {
        await pool.end();
        await source.destroy();
      }
    });
  },
);
