import type { MigrationInterface, QueryRunner } from 'typeorm';

export class VersionSortOrder1724688000000 implements MigrationInterface {
  name = 'VersionSortOrder1724688000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "versions" ADD COLUMN "sortOrder" integer NOT NULL DEFAULT 0',
    );
    await queryRunner.query(`
      UPDATE "versions"
      SET "sortOrder" = (
        SELECT COUNT(*)
        FROM "versions" AS "newer"
        WHERE "newer"."projectId" = "versions"."projectId"
          AND (
            "newer"."createdAt" > "versions"."createdAt"
            OR (
              "newer"."createdAt" = "versions"."createdAt"
              AND "newer"."id" > "versions"."id"
            )
          )
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "versions" DROP COLUMN "sortOrder"');
  }
}
