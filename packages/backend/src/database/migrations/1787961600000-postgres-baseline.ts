import type { MigrationInterface, QueryRunner } from 'typeorm';

const baseColumns = `
  "id" uuid PRIMARY KEY NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
`;

export class PostgresBaseline1787961600000 implements MigrationInterface {
  name = 'PostgresBaseline1787961600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "projects" (
      ${baseColumns}, "key" text NOT NULL UNIQUE, "name" text NOT NULL,
      "description" text, "templateStages" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "requirementSequence" integer NOT NULL DEFAULT 0,
      "bugSequence" integer NOT NULL DEFAULT 0
    )`);
    await queryRunner.query(`CREATE TABLE "project_rhythms" (
      ${baseColumns}, "name" text NOT NULL UNIQUE, "description" text,
      "stages" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "sortOrder" integer NOT NULL DEFAULT 0
    )`);
    await queryRunner.query(`CREATE TABLE "people" (
      ${baseColumns}, "name" text NOT NULL, "note" text,
      "active" boolean NOT NULL DEFAULT true
    )`);
    await queryRunner.query(`CREATE TABLE "versions" (
      ${baseColumns}, "projectId" uuid NOT NULL, "name" text NOT NULL,
      "status" text NOT NULL DEFAULT 'planning',
      "sortOrder" integer NOT NULL DEFAULT 0,
      "plannedStartAt" timestamptz, "plannedReleaseAt" timestamptz,
      "actualReleaseAt" timestamptz, "description" text,
      UNIQUE ("projectId", "name")
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_versions_project" ON "versions" ("projectId")',
    );
    await queryRunner.query(`CREATE TABLE "requirements" (
      ${baseColumns}, "deletedAt" timestamptz, "key" text NOT NULL UNIQUE,
      "projectId" uuid NOT NULL, "versionId" uuid, "title" text NOT NULL,
      "description" text, "ownerIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "lifecycle" text NOT NULL DEFAULT 'not_started',
      "baselineStartAt" timestamptz, "baselineEndAt" timestamptz,
      "plannedStartAt" timestamptz, "plannedEndAt" timestamptz,
      "actualStartAt" timestamptz, "actualEndAt" timestamptz
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_requirements_project" ON "requirements" ("projectId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_requirements_version" ON "requirements" ("versionId")',
    );
    await queryRunner.query(`CREATE TABLE "stages" (
      ${baseColumns}, "deletedAt" timestamptz, "requirementId" uuid NOT NULL,
      "name" text NOT NULL, "workDomain" text NOT NULL DEFAULT 'other',
      "order" integer NOT NULL, "ownerIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "status" text NOT NULL DEFAULT 'not_started', "note" text,
      "statusReason" text, "expectedResumeAt" timestamptz,
      "baselineStartAt" timestamptz, "baselineEndAt" timestamptz,
      "plannedStartAt" timestamptz, "plannedEndAt" timestamptz,
      "actualStartAt" timestamptz, "actualEndAt" timestamptz
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_stages_requirement" ON "stages" ("requirementId")',
    );
    await queryRunner.query(`CREATE TABLE "bugs" (
      ${baseColumns}, "deletedAt" timestamptz, "key" text NOT NULL UNIQUE,
      "requirementId" uuid NOT NULL, "title" text NOT NULL, "description" text,
      "ownerIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "status" text NOT NULL DEFAULT 'not_started', "statusReason" text,
      "expectedResumeAt" timestamptz, "discoveredStageId" uuid,
      "discoveredVersionId" uuid, "targetVersionId" uuid,
      "baselineStartAt" timestamptz, "baselineEndAt" timestamptz,
      "plannedStartAt" timestamptz, "plannedEndAt" timestamptz,
      "actualStartAt" timestamptz, "actualEndAt" timestamptz
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_bugs_requirement" ON "bugs" ("requirementId")',
    );
    await queryRunner.query(`CREATE TABLE "status_history" (
      "id" uuid PRIMARY KEY NOT NULL, "entityType" text NOT NULL,
      "entityId" uuid NOT NULL, "fromStatus" text, "toStatus" text NOT NULL,
      "effectiveAt" timestamptz NOT NULL, "note" text, "reason" text,
      "expectedResumeAt" timestamptz, "source" text NOT NULL, "agentName" text,
      "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_status_entity_time" ON "status_history" ("entityType", "entityId", "effectiveAt")',
    );
    await queryRunner.query(`CREATE TABLE "schedule_history" (
      "id" uuid PRIMARY KEY NOT NULL, "entityType" text NOT NULL,
      "entityId" uuid NOT NULL, "oldStartAt" timestamptz, "oldEndAt" timestamptz,
      "newStartAt" timestamptz, "newEndAt" timestamptz, "reason" text,
      "source" text NOT NULL, "agentName" text,
      "changedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_schedule_entity_time" ON "schedule_history" ("entityType", "entityId", "changedAt")',
    );
    await queryRunner.query(`CREATE TABLE "version_history" (
      "id" uuid PRIMARY KEY NOT NULL, "requirementId" uuid NOT NULL,
      "fromVersionId" uuid, "toVersionId" uuid, "reason" text,
      "source" text NOT NULL, "agentName" text, "effectiveAt" timestamptz,
      "changedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_version_history_requirement" ON "version_history" ("requirementId", "changedAt")',
    );
    await queryRunner.query(`CREATE TABLE "dependencies" (
      "id" uuid PRIMARY KEY NOT NULL, "successorType" text NOT NULL,
      "successorId" uuid NOT NULL, "predecessorType" text NOT NULL,
      "predecessorId" uuid NOT NULL, "note" text,
      "active" boolean NOT NULL DEFAULT true, "source" text NOT NULL,
      "agentName" text, "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "resolvedAt" timestamptz
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_dependency_successor" ON "dependencies" ("successorType", "successorId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_dependency_predecessor" ON "dependencies" ("predecessorType", "predecessorId")',
    );
    await queryRunner.query(`CREATE TABLE "change_events" (
      "id" uuid PRIMARY KEY NOT NULL, "entityType" text NOT NULL,
      "entityId" uuid NOT NULL, "projectId" uuid, "requirementId" uuid,
      "type" text NOT NULL, "summary" text NOT NULL, "details" jsonb,
      "reason" text, "source" text NOT NULL, "agentName" text,
      "occurredAt" timestamptz NOT NULL
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_changes_time" ON "change_events" ("occurredAt")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_changes_project_time" ON "change_events" ("projectId", "occurredAt")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'change_events',
      'dependencies',
      'version_history',
      'schedule_history',
      'status_history',
      'bugs',
      'stages',
      'requirements',
      'versions',
      'people',
      'project_rhythms',
      'projects',
    ]) {
      await queryRunner.query(`DROP TABLE "${table}"`);
    }
  }
}
