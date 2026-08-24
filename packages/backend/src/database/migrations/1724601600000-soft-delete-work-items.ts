import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SoftDeleteWorkItems1724601600000 implements MigrationInterface {
  name = 'SoftDeleteWorkItems1724601600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "requirements" ADD COLUMN "deletedAt" datetime',
    );
    await queryRunner.query(
      'ALTER TABLE "stages" ADD COLUMN "deletedAt" datetime',
    );
    await queryRunner.query(
      'ALTER TABLE "bugs" ADD COLUMN "deletedAt" datetime',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "bugs" DROP COLUMN "deletedAt"');
    await queryRunner.query('ALTER TABLE "stages" DROP COLUMN "deletedAt"');
    await queryRunner.query(
      'ALTER TABLE "requirements" DROP COLUMN "deletedAt"',
    );
  }
}
