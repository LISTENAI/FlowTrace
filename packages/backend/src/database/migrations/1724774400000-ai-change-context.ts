import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AiChangeContext1724774400000 implements MigrationInterface {
  name = 'AiChangeContext1724774400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "version_history" ADD COLUMN "effectiveAt" datetime',
    );
    await queryRunner.query(
      'UPDATE "version_history" SET "effectiveAt" = "changedAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "change_events" ADD COLUMN "reason" text',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "change_events" DROP COLUMN "reason"');
    await queryRunner.query(
      'ALTER TABLE "version_history" DROP COLUMN "effectiveAt"',
    );
  }
}
