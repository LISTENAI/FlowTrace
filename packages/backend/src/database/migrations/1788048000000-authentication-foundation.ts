import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthenticationFoundation1788048000000 implements MigrationInterface {
  name = 'AuthenticationFoundation1788048000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "people" ADD "email" text');
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_people_email" ON "people" ("email") WHERE "email" IS NOT NULL',
    );

    await queryRunner.query(`CREATE TABLE "auth_user" (
      "id" text PRIMARY KEY NOT NULL, "name" text NOT NULL,
      "email" text NOT NULL UNIQUE, "emailVerified" boolean NOT NULL DEFAULT false,
      "image" text, "createdAt" timestamptz NOT NULL,
      "updatedAt" timestamptz NOT NULL
    )`);
    await queryRunner.query(`CREATE TABLE "auth_session" (
      "id" text PRIMARY KEY NOT NULL, "expiresAt" timestamptz NOT NULL,
      "token" text NOT NULL UNIQUE, "createdAt" timestamptz NOT NULL,
      "updatedAt" timestamptz NOT NULL, "ipAddress" text, "userAgent" text,
      "userId" text NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_auth_session_user" ON "auth_session" ("userId")',
    );
    await queryRunner.query(`CREATE TABLE "auth_account" (
      "id" text PRIMARY KEY NOT NULL, "issuer" text NOT NULL,
      "accountId" text NOT NULL, "providerId" text NOT NULL,
      "userId" text NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE,
      "accessToken" text, "refreshToken" text, "idToken" text,
      "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz,
      "scope" text, "password" text, "createdAt" timestamptz NOT NULL,
      "updatedAt" timestamptz NOT NULL,
      UNIQUE ("issuer", "accountId")
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_auth_account_user" ON "auth_account" ("userId")',
    );
    await queryRunner.query(`CREATE TABLE "auth_verification" (
      "id" text PRIMARY KEY NOT NULL, "identifier" text NOT NULL,
      "value" text NOT NULL, "expiresAt" timestamptz NOT NULL,
      "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_auth_verification_identifier" ON "auth_verification" ("identifier")',
    );
    await queryRunner.query(`CREATE TABLE "auth_api_key" (
      "id" text PRIMARY KEY NOT NULL, "configId" text NOT NULL DEFAULT 'default',
      "name" text, "start" text, "referenceId" text NOT NULL, "prefix" text,
      "key" text NOT NULL, "refillInterval" integer, "refillAmount" integer,
      "lastRefillAt" timestamptz, "enabled" boolean DEFAULT true,
      "rateLimitEnabled" boolean DEFAULT true,
      "rateLimitTimeWindow" integer DEFAULT 60000,
      "rateLimitMax" integer DEFAULT 1000, "requestCount" integer DEFAULT 0,
      "remaining" integer, "lastRequest" timestamptz, "expiresAt" timestamptz,
      "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL,
      "permissions" text, "metadata" text
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_auth_api_key_config" ON "auth_api_key" ("configId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_auth_api_key_reference" ON "auth_api_key" ("referenceId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_auth_api_key_key" ON "auth_api_key" ("key")',
    );
    await queryRunner.query(`CREATE TABLE "auth_person_bindings" (
      "id" uuid PRIMARY KEY NOT NULL, "authUserId" text NOT NULL,
      "personId" uuid NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FK_auth_person_user" FOREIGN KEY ("authUserId")
        REFERENCES "auth_user" ("id") ON DELETE CASCADE,
      CONSTRAINT "FK_auth_person_person" FOREIGN KEY ("personId")
        REFERENCES "people" ("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_auth_person_user" ON "auth_person_bindings" ("authUserId")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_auth_person_person" ON "auth_person_bindings" ("personId")',
    );
  }

  async down(): Promise<void> {
    // 认证结构一经上线需要永久兼容旧版本，不提供破坏性回退。
  }
}
