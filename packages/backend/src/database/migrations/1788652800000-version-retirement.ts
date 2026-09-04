import type { MigrationInterface, QueryRunner } from 'typeorm';

export class VersionRetirement1788652800000 implements MigrationInterface {
  name = 'VersionRetirement1788652800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "versions" ADD COLUMN "deletedAt" timestamptz',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "versions" DROP COLUMN "deletedAt"');
  }
}
