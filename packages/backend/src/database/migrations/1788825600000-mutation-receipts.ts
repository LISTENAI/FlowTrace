import type { MigrationInterface, QueryRunner } from 'typeorm';

export class MutationReceipts1788825600000 implements MigrationInterface {
  name = 'MutationReceipts1788825600000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      'CREATE TABLE "mutation_receipts" ("id" text PRIMARY KEY, "requestId" uuid NOT NULL, "actorUserId" text NOT NULL, "fingerprint" text NOT NULL, "statusCode" integer NOT NULL, "response" jsonb NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now())',
    );
    for (const table of [
      'change_events',
      'status_history',
      'schedule_history',
      'version_history',
    ]) {
      await runner.query(`ALTER TABLE "${table}" ADD COLUMN "mutationId" uuid`);
      await runner.query(
        `CREATE INDEX "IDX_${table}_mutation" ON "${table}" ("mutationId")`,
      );
    }
    await runner.query(
      'ALTER TABLE "change_events" ADD COLUMN "actor" jsonb, ADD COLUMN "sourceRef" text, ADD COLUMN "reportedAt" timestamptz',
    );
    await runner.query(
      'CREATE INDEX "IDX_changes_source_ref" ON "change_events" ("sourceRef")',
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE "mutation_receipts"');
    for (const table of [
      'change_events',
      'status_history',
      'schedule_history',
      'version_history',
    ]) {
      await runner.query(`DROP INDEX "IDX_${table}_mutation"`);
      await runner.query(`ALTER TABLE "${table}" DROP COLUMN "mutationId"`);
    }
    await runner.query('DROP INDEX "IDX_changes_source_ref"');
    await runner.query(
      'ALTER TABLE "change_events" DROP COLUMN "actor", DROP COLUMN "sourceRef", DROP COLUMN "reportedAt"',
    );
  }
}
