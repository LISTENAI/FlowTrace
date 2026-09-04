import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PersonWork1788566400000 implements MigrationInterface {
  name = 'PersonWork1788566400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE SEQUENCE "action_item_key_seq" START WITH 1 INCREMENT BY 1',
    );
    await queryRunner.query(`
      CREATE TABLE "action_items" (
        "id" uuid NOT NULL,
        "key" text NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "projectId" uuid,
        "requirementId" uuid,
        "ownerIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "status" text NOT NULL DEFAULT 'not_started',
        "statusReason" text,
        "expectedResumeAt" timestamptz,
        "createdByPersonId" uuid NOT NULL,
        "baselineStartAt" timestamptz,
        "baselineEndAt" timestamptz,
        "plannedStartAt" timestamptz,
        "plannedEndAt" timestamptz,
        "actualStartAt" timestamptz,
        "actualEndAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz,
        CONSTRAINT "PK_action_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_action_items_key" UNIQUE ("key")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_action_items_project" ON "action_items" ("projectId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_action_items_requirement" ON "action_items" ("requirementId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_action_items_creator" ON "action_items" ("createdByPersonId")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "action_items"');
    await queryRunner.query('DROP SEQUENCE "action_item_key_seq"');
  }
}
