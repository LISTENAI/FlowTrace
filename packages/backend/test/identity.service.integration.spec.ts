import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import type { DataSource } from 'typeorm';
import type { AuthProviderInfo } from '@flowtrace/shared';
import { IdentityService } from '@/auth/identity.service';
import { AuthPersonBindingEntity, PersonEntity } from '@/database/entities';
import { createTestDataSource } from './support/database';

const wecomProvider: AuthProviderInfo = {
  id: 'wecom',
  name: '企业微信',
  kind: 'external',
  nameAuthority: 'provider',
  emailAuthority: 'provider',
};

const localProvider: AuthProviderInfo = {
  id: 'local',
  name: '本地账号',
  kind: 'local',
  nameAuthority: 'flowtrace',
  emailAuthority: 'account',
};

let dataSource: DataSource | undefined;

afterEach(async () => {
  if (dataSource?.isInitialized) await dataSource.destroy();
});

async function insertAuthAccount(
  user: { id: string; name: string; email: string; emailVerified: boolean },
  providerId: string,
  localOwner = providerId === 'credential',
) {
  await dataSource!.query(
    `INSERT INTO "auth_user"
      ("id", "name", "email", "emailVerified", "localOwner", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [user.id, user.name, user.email, user.emailVerified, localOwner],
  );
  await dataSource!.query(
    `INSERT INTO "auth_account"
      ("id", "issuer", "accountId", "providerId", "userId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      `account-${user.id}`,
      providerId,
      `subject-${user.id}`,
      providerId,
      user.id,
    ],
  );
}

function service(provider: AuthProviderInfo) {
  return new IdentityService(dataSource!, provider);
}

describe('IdentityService', () => {
  it('automatically binds a verified enterprise email to an existing person', async () => {
    dataSource = await createTestDataSource();
    const people = dataSource.getRepository(PersonEntity);
    const bindings = dataSource.getRepository(AuthPersonBindingEntity);
    const person = await people.save(
      people.create({
        id: 'a4acaed3-2e84-4d7d-a30d-6e0a11c98eb3',
        name: '预建姓名',
        email: 'zhangsan@example.com',
        note: null,
        active: true,
      }),
    );
    const user = {
      id: 'auth-user',
      name: '张三',
      email: 'ZHANGSAN@example.com',
      emailVerified: true,
    };
    await insertAuthAccount(user, 'wecom');

    const identity = await service(wecomProvider).current(user);

    expect(identity.person.id).toBe(person.id);
    expect(identity.person.name).toBe('张三');
    expect(identity.person.identity).toMatchObject({
      providerId: 'wecom',
      nameAuthority: 'provider',
      emailAuthority: 'provider',
    });
    expect(await bindings.count()).toBe(1);
  });

  it('keeps repeated first identity resolution idempotent', async () => {
    dataSource = await createTestDataSource();
    const user = {
      id: 'concurrent-auth-user',
      name: '并发成员',
      email: 'concurrent@example.com',
      emailVerified: true,
    };
    await insertAuthAccount(user, 'wecom');

    const first = await service(wecomProvider).current(user);
    const second = await service(wecomProvider).current(user);

    expect(second.person.id).toBe(first.person.id);
    expect(await dataSource.getRepository(PersonEntity).count()).toBe(1);
    expect(
      await dataSource.getRepository(AuthPersonBindingEntity).count(),
    ).toBe(1);
  });

  it('creates and binds a person when an external provider has no email', async () => {
    dataSource = await createTestDataSource();
    const user = {
      id: 'auth-user-without-email',
      name: '企业成员',
      email: 'wecom-anonymous@flowtrace.invalid',
      emailVerified: false,
    };
    await insertAuthAccount(user, 'wecom');

    const identity = await service(wecomProvider).current(user);

    expect(identity.person).toMatchObject({ name: '企业成员' });
    expect(identity.person.email).toBeUndefined();
    expect(
      await dataSource.getRepository(AuthPersonBindingEntity).count(),
    ).toBe(1);
  });

  it('trusts the local owner email and keeps the display name editable', async () => {
    dataSource = await createTestDataSource();
    const user = {
      id: 'local-owner',
      name: '个人用户',
      email: 'owner@example.com',
      emailVerified: false,
    };
    await insertAuthAccount(user, 'credential');

    const identity = await service(localProvider).current(user);

    expect(identity.person).toMatchObject({
      name: '个人用户',
      email: 'owner@example.com',
    });
    expect(identity.person.identity).toMatchObject({
      nameAuthority: 'flowtrace',
      emailAuthority: 'account',
    });
  });

  it('rejects a legacy local account that is not the instance owner', async () => {
    dataSource = await createTestDataSource();
    const user = {
      id: 'legacy-local-user',
      name: '旧账号',
      email: 'legacy@example.com',
      emailVerified: false,
    };
    await insertAuthAccount(user, 'credential', false);

    await expect(service(localProvider).current(user)).rejects.toThrow(
      '当前本地账号不是此实例的所有者',
    );
  });
});
