import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectAgentHandoff1788220800000 implements MigrationInterface {
  name = 'ProjectAgentHandoff1788220800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "projects" ADD COLUMN "agentHandoff" text',
    );
    await queryRunner.query(
      'ALTER TABLE "projects" ADD COLUMN "agentHandoffRevision" integer NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE "projects" ADD COLUMN "agentHandoffSource" text',
    );
    await queryRunner.query(
      'ALTER TABLE "projects" ADD COLUMN "agentHandoffAgentName" text',
    );
    await queryRunner.query(
      'ALTER TABLE "projects" ADD COLUMN "agentHandoffAgentModel" text',
    );
    await queryRunner.query(
      'ALTER TABLE "projects" ADD COLUMN "agentHandoffReason" text',
    );
    await queryRunner.query(
      'ALTER TABLE "projects" ADD COLUMN "agentHandoffUpdatedAt" timestamptz',
    );
    await queryRunner.query(`CREATE TABLE "project_agent_handoff_history" (
      "id" uuid PRIMARY KEY NOT NULL, "projectId" uuid NOT NULL,
      "revision" integer NOT NULL, "content" text NOT NULL,
      "source" text NOT NULL, "agentName" text, "agentModel" text,
      "reason" text,
      "createdAt" timestamptz NOT NULL,
      UNIQUE ("projectId", "revision")
    )`);
    for (const table of [
      'status_history',
      'schedule_history',
      'version_history',
      'dependencies',
      'change_events',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN "agentModel" text`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'change_events',
      'dependencies',
      'version_history',
      'schedule_history',
      'status_history',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "agentModel"`,
      );
    }
    await queryRunner.query('DROP TABLE "project_agent_handoff_history"');
    await queryRunner.query(
      'ALTER TABLE "projects" DROP COLUMN "agentHandoffUpdatedAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "projects" DROP COLUMN "agentHandoffReason"',
    );
    await queryRunner.query(
      'ALTER TABLE "projects" DROP COLUMN "agentHandoffAgentModel"',
    );
    await queryRunner.query(
      'ALTER TABLE "projects" DROP COLUMN "agentHandoffAgentName"',
    );
    await queryRunner.query(
      'ALTER TABLE "projects" DROP COLUMN "agentHandoffSource"',
    );
    await queryRunner.query(
      'ALTER TABLE "projects" DROP COLUMN "agentHandoffRevision"',
    );
    await queryRunner.query(
      'ALTER TABLE "projects" DROP COLUMN "agentHandoff"',
    );
  }
}
