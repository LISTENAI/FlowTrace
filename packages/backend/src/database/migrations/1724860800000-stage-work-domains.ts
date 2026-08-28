import type { MigrationInterface, QueryRunner } from 'typeorm';

export class StageWorkDomains1724860800000 implements MigrationInterface {
  name = 'StageWorkDomains1724860800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stages" ADD COLUMN "workDomain" text NOT NULL DEFAULT 'other'`,
    );
    await queryRunner.query(`
      UPDATE "stages"
      SET "workDomain" = CASE
        WHEN lower("name") LIKE '%发布%'
          OR lower("name") LIKE '%上线%'
          OR lower("name") LIKE '%交付%'
          OR lower("name") LIKE '%定版%'
          OR lower("name") LIKE '%定稿%'
          OR lower("name") LIKE '%量产%'
          OR lower("name") LIKE '%出厂%' THEN 'delivery'
        WHEN lower("name") LIKE '%联调%'
          OR lower("name") LIKE '%测试%'
          OR lower("name") LIKE '%验证%'
          OR lower("name") LIKE '%验收%'
          OR lower("name") LIKE '%回归%'
          OR lower("name") LIKE '%试用%'
          OR lower("name") LIKE '%测评%' THEN 'verification'
        WHEN lower("name") LIKE '%方案%'
          OR lower("name") LIKE '%设计%'
          OR lower("name") LIKE '%架构%'
          OR lower("name") LIKE '%规格%'
          OR lower("name") LIKE '%原型%' THEN 'design'
        WHEN lower("name") LIKE '%需求%'
          OR lower("name") LIKE '%产品%'
          OR lower("name") LIKE '%调研%'
          OR lower("name") LIKE '%立项%'
          OR lower("name") LIKE '%评审%' THEN 'product'
        WHEN lower("name") LIKE '%开发%'
          OR lower("name") LIKE '%研发%'
          OR lower("name") LIKE '%实现%'
          OR lower("name") LIKE '%编码%'
          OR lower("name") LIKE '%拆分%'
          OR lower("name") LIKE '%调试%'
          OR lower("name") LIKE '%适配%'
          OR lower("name") LIKE '%移植%'
          OR lower("name") LIKE '%重构%'
          OR lower("name") LIKE '%打样%'
          OR lower("name") LIKE '%采购%'
          OR lower("name") LIKE '%生产%'
          OR lower("name") LIKE '%agent%'
          OR lower("name") LIKE '%工具%' THEN 'implementation'
        ELSE 'other'
      END
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "stages" DROP COLUMN "workDomain"');
  }
}
