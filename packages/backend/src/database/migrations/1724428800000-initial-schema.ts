import type { MigrationInterface, QueryRunner } from 'typeorm';

const auditColumns = `
  "id" varchar PRIMARY KEY NOT NULL,
  "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
  "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
`;

export class InitialSchema1724428800000 implements MigrationInterface {
  name = 'InitialSchema1724428800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "projects" (
      ${auditColumns}, "key" varchar NOT NULL UNIQUE, "name" varchar NOT NULL,
      "description" text, "templateStages" text NOT NULL DEFAULT '[]',
      "requirementSequence" integer NOT NULL DEFAULT 0,
      "bugSequence" integer NOT NULL DEFAULT 0
    )`);
    await queryRunner.query(`CREATE TABLE "people" (
      ${auditColumns}, "name" varchar NOT NULL, "note" text,
      "active" boolean NOT NULL DEFAULT 1
    )`);
    await queryRunner.query(`CREATE TABLE "versions" (
      ${auditColumns}, "projectId" varchar NOT NULL, "name" varchar NOT NULL,
      "status" varchar NOT NULL DEFAULT 'planning', "plannedStartAt" datetime,
      "plannedReleaseAt" datetime, "actualReleaseAt" datetime, "description" text,
      UNIQUE ("projectId", "name")
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_versions_project" ON "versions" ("projectId")',
    );
    await queryRunner.query(`CREATE TABLE "requirements" (
      ${auditColumns}, "key" varchar NOT NULL UNIQUE, "projectId" varchar NOT NULL,
      "versionId" varchar, "title" varchar NOT NULL, "description" text,
      "ownerIds" text NOT NULL DEFAULT '[]',
      "lifecycle" varchar NOT NULL DEFAULT 'not_started',
      "baselineStartAt" datetime, "baselineEndAt" datetime,
      "plannedStartAt" datetime, "plannedEndAt" datetime,
      "actualStartAt" datetime, "actualEndAt" datetime
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_requirements_project" ON "requirements" ("projectId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_requirements_version" ON "requirements" ("versionId")',
    );
    await queryRunner.query(`CREATE TABLE "stages" (
      ${auditColumns}, "requirementId" varchar NOT NULL, "name" varchar NOT NULL,
      "order" integer NOT NULL, "ownerIds" text NOT NULL DEFAULT '[]',
      "status" varchar NOT NULL DEFAULT 'not_started', "note" text,
      "statusReason" text, "expectedResumeAt" datetime,
      "baselineStartAt" datetime, "baselineEndAt" datetime,
      "plannedStartAt" datetime, "plannedEndAt" datetime,
      "actualStartAt" datetime, "actualEndAt" datetime
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_stages_requirement" ON "stages" ("requirementId")',
    );
    await queryRunner.query(`CREATE TABLE "bugs" (
      ${auditColumns}, "key" varchar NOT NULL UNIQUE, "requirementId" varchar NOT NULL,
      "title" varchar NOT NULL, "description" text,
      "ownerIds" text NOT NULL DEFAULT '[]', "status" varchar NOT NULL DEFAULT 'not_started',
      "statusReason" text, "expectedResumeAt" datetime, "discoveredStageId" varchar,
      "discoveredVersionId" varchar, "targetVersionId" varchar,
      "baselineStartAt" datetime, "baselineEndAt" datetime,
      "plannedStartAt" datetime, "plannedEndAt" datetime,
      "actualStartAt" datetime, "actualEndAt" datetime
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_bugs_requirement" ON "bugs" ("requirementId")',
    );
    await queryRunner.query(`CREATE TABLE "status_history" (
      "id" varchar PRIMARY KEY NOT NULL, "entityType" varchar NOT NULL,
      "entityId" varchar NOT NULL, "fromStatus" varchar, "toStatus" varchar NOT NULL,
      "effectiveAt" datetime NOT NULL, "note" text, "reason" text,
      "expectedResumeAt" datetime, "source" varchar NOT NULL, "agentName" varchar,
      "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_status_entity_time" ON "status_history" ("entityType", "entityId", "effectiveAt")',
    );
    await queryRunner.query(`CREATE TABLE "schedule_history" (
      "id" varchar PRIMARY KEY NOT NULL, "entityType" varchar NOT NULL,
      "entityId" varchar NOT NULL, "oldStartAt" datetime, "oldEndAt" datetime,
      "newStartAt" datetime, "newEndAt" datetime, "reason" text,
      "source" varchar NOT NULL, "agentName" varchar,
      "changedAt" datetime NOT NULL DEFAULT (datetime('now'))
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_schedule_entity_time" ON "schedule_history" ("entityType", "entityId", "changedAt")',
    );
    await queryRunner.query(`CREATE TABLE "version_history" (
      "id" varchar PRIMARY KEY NOT NULL, "requirementId" varchar NOT NULL,
      "fromVersionId" varchar, "toVersionId" varchar, "reason" text,
      "source" varchar NOT NULL, "agentName" varchar,
      "changedAt" datetime NOT NULL DEFAULT (datetime('now'))
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_version_history_requirement" ON "version_history" ("requirementId", "changedAt")',
    );
    await queryRunner.query(`CREATE TABLE "dependencies" (
      "id" varchar PRIMARY KEY NOT NULL, "successorType" varchar NOT NULL,
      "successorId" varchar NOT NULL, "predecessorType" varchar NOT NULL,
      "predecessorId" varchar NOT NULL, "note" text, "active" boolean NOT NULL DEFAULT 1,
      "source" varchar NOT NULL, "agentName" varchar,
      "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "resolvedAt" datetime
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_dependency_successor" ON "dependencies" ("successorType", "successorId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_dependency_predecessor" ON "dependencies" ("predecessorType", "predecessorId")',
    );
    await queryRunner.query(`CREATE TABLE "change_events" (
      "id" varchar PRIMARY KEY NOT NULL, "entityType" varchar NOT NULL,
      "entityId" varchar NOT NULL, "projectId" varchar, "requirementId" varchar,
      "type" varchar NOT NULL, "summary" text NOT NULL, "details" text,
      "source" varchar NOT NULL, "agentName" varchar, "occurredAt" datetime NOT NULL
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
      'projects',
    ]) {
      await queryRunner.query(`DROP TABLE "${table}"`);
    }
  }
}
