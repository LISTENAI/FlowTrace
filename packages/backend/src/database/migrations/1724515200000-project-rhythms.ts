import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectRhythms1724515200000 implements MigrationInterface {
  name = 'ProjectRhythms1724515200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "project_rhythms" (
      "id" varchar PRIMARY KEY NOT NULL,
      "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
      "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
      "name" varchar NOT NULL UNIQUE, "description" text,
      "stages" text NOT NULL DEFAULT '[]', "sortOrder" integer NOT NULL DEFAULT 0
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "project_rhythms"');
  }
}
