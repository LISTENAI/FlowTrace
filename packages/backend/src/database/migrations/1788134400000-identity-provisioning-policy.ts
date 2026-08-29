import type { MigrationInterface, QueryRunner } from 'typeorm';

export class IdentityProvisioningPolicy1788134400000 implements MigrationInterface {
  name = 'IdentityProvisioningPolicy1788134400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "auth_user" ADD "localOwner" boolean NOT NULL DEFAULT false',
    );
    const credentialUsers = (await queryRunner.query(
      `SELECT "userId" FROM "auth_account"
       WHERE "providerId" = 'credential'
       ORDER BY "createdAt" ASC LIMIT 1`,
    )) as Array<{ userId: string }>;
    if (credentialUsers[0]) {
      await queryRunner.query(
        'UPDATE "auth_user" SET "localOwner" = true WHERE "id" = $1',
        [credentialUsers[0].userId],
      );
    }
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_auth_user_local_owner" ON "auth_user" ("localOwner") WHERE "localOwner" = true',
    );

    await queryRunner.query(
      'ALTER TABLE "auth_person_bindings" ADD "providerId" text',
    );
    await queryRunner.query(
      'ALTER TABLE "auth_person_bindings" ADD "providerSubject" text',
    );
    await queryRunner.query(
      `ALTER TABLE "auth_person_bindings" ADD "nameAuthority" text NOT NULL DEFAULT 'flowtrace'`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_person_bindings" ADD "emailAuthority" text NOT NULL DEFAULT 'account'`,
    );
    const bindings = (await queryRunner.query(
      'SELECT "id", "authUserId" FROM "auth_person_bindings"',
    )) as Array<{ id: string; authUserId: string }>;
    for (const binding of bindings) {
      const accounts = (await queryRunner.query(
        `SELECT "accountId", "providerId" FROM "auth_account"
         WHERE "userId" = $1 ORDER BY "createdAt" ASC LIMIT 1`,
        [binding.authUserId],
      )) as Array<{ accountId: string; providerId: string }>;
      const account = accounts[0];
      if (!account) {
        throw new Error(`认证人员关联 ${binding.id} 缺少登录账号来源`);
      }
      const local = account.providerId === 'credential';
      await queryRunner.query(
        `UPDATE "auth_person_bindings"
         SET "providerId" = $1, "providerSubject" = $2,
             "nameAuthority" = $3, "emailAuthority" = $4
         WHERE "id" = $5`,
        [
          local ? 'local' : account.providerId,
          account.accountId,
          local ? 'flowtrace' : 'provider',
          local ? 'account' : 'provider',
          binding.id,
        ],
      );
    }
    await queryRunner.query(
      'ALTER TABLE "auth_person_bindings" ALTER COLUMN "providerId" SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "auth_person_bindings" ALTER COLUMN "providerSubject" SET NOT NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_auth_person_provider_subject" ON "auth_person_bindings" ("providerId", "providerSubject")',
    );
  }

  async down(): Promise<void> {
    // 身份来源与单一所有者约束一经上线需保持兼容，不提供破坏性回退。
  }
}
