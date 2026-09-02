import type { MigrationInterface, QueryRunner } from 'typeorm';

export class StageSupersession1788393600000 implements MigrationInterface {
  name = 'StageSupersession1788393600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "stages" ADD COLUMN "supersededByStageId" uuid',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_stages_superseded_by" ON "stages" ("supersededByStageId")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_stages_superseded_by"');
    await queryRunner.query(
      'ALTER TABLE "stages" DROP COLUMN "supersededByStageId"',
    );
  }
}
