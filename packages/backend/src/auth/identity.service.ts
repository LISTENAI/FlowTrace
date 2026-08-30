import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import type {
  AuthProviderInfo,
  CurrentIdentity,
  Person,
} from '@flowtrace/shared';
import {
  FLOWTRACE_AUTH_PROVIDER,
  publicAuthProviderInfo,
} from '@/auth/provider';
import { AuthPersonBindingEntity, PersonEntity } from '@/database/entities';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

interface AuthAccountRow {
  accountId: string;
  providerId: string;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function realEmail(user: AuthUser, provider: AuthProviderInfo) {
  const email = normalizeEmail(user.email);
  if (!email || email.endsWith('@flowtrace.invalid')) return undefined;
  if (provider.kind === 'external' && !user.emailVerified) return undefined;
  return email;
}

function displayName(user: AuthUser) {
  return user.name.trim().slice(0, 50) || '未命名成员';
}

@Injectable()
export class IdentityService {
  constructor(
    @Inject(DataSource)
    private readonly dataSource: DataSource,
    @Inject(FLOWTRACE_AUTH_PROVIDER)
    private readonly provider: AuthProviderInfo,
  ) {}

  async current(user: AuthUser): Promise<CurrentIdentity> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        [`flowtrace:identity:${user.id}`],
      );
      return this.currentLocked(user, manager);
    });
  }

  private async currentLocked(user: AuthUser, manager: EntityManager) {
    const bindings = manager.getRepository(AuthPersonBindingEntity);
    const people = manager.getRepository(PersonEntity);
    const account = await this.accountForUser(user.id, manager);
    const binding = await bindings.findOneBy({ authUserId: user.id });
    if (binding) {
      if (
        binding.providerId !== account.providerId ||
        binding.providerSubject !== account.subject
      ) {
        throw new ConflictException(
          '登录账号的身份来源与既有人员关联不一致，请联系管理员处理',
        );
      }
      const person = await people.findOneBy({ id: binding.personId });
      if (!person) {
        throw new ConflictException('登录账号关联的人员档案已经不存在');
      }
      await this.syncManagedProfile(user, person, binding, people);
      await people.save(person);
      return this.result(user, person, binding);
    }

    const email = realEmail(user, this.provider);
    let person = email ? await people.findOneBy({ email }) : null;
    if (!person) {
      person = people.create({
        id: randomUUID(),
        name: displayName(user),
        email: email ?? null,
        note: null,
        active: true,
      });
    }
    const claimed = await bindings.findOneBy({ personId: person.id });
    if (claimed && claimed.authUserId !== user.id) {
      throw new ConflictException(
        '该企业标识已经关联其他登录账号，请联系管理员核对人员档案',
      );
    }

    const createdBinding = bindings.create({
      id: randomUUID(),
      authUserId: user.id,
      personId: person.id,
      providerId: account.providerId,
      providerSubject: account.subject,
      nameAuthority: this.provider.nameAuthority,
      emailAuthority: this.provider.emailAuthority,
    });
    await this.syncManagedProfile(user, person, createdBinding, people);
    person = await people.save(person);
    await bindings.save(createdBinding);
    return this.result(user, person, createdBinding);
  }

  private async accountForUser(userId: string, manager: EntityManager) {
    const expectedProvider =
      this.provider.kind === 'local' ? 'credential' : this.provider.id;
    const rows = (await manager.query(
      `SELECT account."accountId", account."providerId"
       FROM "auth_account" account
       JOIN "auth_user" auth_user ON auth_user."id" = account."userId"
       WHERE account."userId" = $1 AND account."providerId" = $2
         AND ($3 = false OR auth_user."localOwner" = true)
       ORDER BY account."createdAt" ASC LIMIT 1`,
      [userId, expectedProvider, this.provider.kind === 'local'],
    )) as AuthAccountRow[];
    const account = rows[0];
    if (!account) {
      throw new ConflictException(
        this.provider.kind === 'local'
          ? '当前本地账号不是此实例的所有者'
          : '登录账号与当前部署指定的身份提供方不一致，请联系管理员处理',
      );
    }
    return { providerId: this.provider.id, subject: account.accountId };
  }

  private async syncManagedProfile(
    user: AuthUser,
    person: PersonEntity,
    binding: AuthPersonBindingEntity,
    people: Repository<PersonEntity>,
  ) {
    if (binding.nameAuthority !== 'flowtrace') {
      person.name = displayName(user);
    }
    if (
      binding.emailAuthority === 'provider' ||
      binding.emailAuthority === 'account'
    ) {
      const email = realEmail(user, this.provider);
      if (email && email !== person.email) {
        const claimed = await people.findOneBy({ email });
        if (claimed && claimed.id !== person.id) {
          throw new ConflictException(
            '身份提供方返回的邮箱已经被其他人员使用，请联系管理员处理',
          );
        }
        person.email = email;
      }
    }
  }

  private result(
    user: AuthUser,
    person: PersonEntity,
    binding: AuthPersonBindingEntity,
  ): CurrentIdentity {
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
      },
      person: this.toPerson(person, binding),
      provider: publicAuthProviderInfo(this.provider),
    };
  }

  private toPerson(
    row: PersonEntity,
    binding: AuthPersonBindingEntity,
  ): Person {
    return {
      id: row.id,
      name: row.name,
      email: row.email ?? undefined,
      note: row.note ?? undefined,
      active: row.active,
      identity: {
        providerId: binding.providerId,
        nameAuthority: binding.nameAuthority,
        emailAuthority: binding.emailAuthority,
      },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
