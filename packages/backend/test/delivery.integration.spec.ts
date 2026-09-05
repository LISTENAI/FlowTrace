import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { DomainModule } from '@/domain/domain.module';
import { WorkService } from '@/domain/work.service';
import { VersionEntity, StatusHistoryEntity } from '@/database/entities';
import { createTestDataSource } from './support/database';

describe('delivery scope and audit', () => {
  let ds: DataSource;
  let work: WorkService;
  beforeAll(async () => {
    ds = await createTestDataSource();
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useFactory: () => ds.options as TypeOrmModuleOptions,
          dataSourceFactory: async () => ds,
        }),
        DomainModule,
      ],
    }).compile();
    work = module.get(WorkService);
  });
  afterAll(async () => {
    await ds.destroy();
  });

  it('includes fixes from older requirements only in the committed target version', async () => {
    const project = await work.createProject({
      key: 'FIXES',
      name: '跨版本修复',
    });
    const old = await work.createVersion(project.id, { name: '1.0' });
    const next = await work.createVersion(project.id, { name: '2.0' });
    const requirement = await work.createRequirement({
      projectId: project.id,
      versionId: old.id,
      title: '原交付',
      stages: [],
    });
    const bug = await work.reportBug(requirement.id, {
      title: '后续修复',
      targetVersionId: next.id,
    });
    expect(
      (await work.getVersionSnapshot(next.id)).openBugs.map((item) => item.id),
    ).toEqual([bug.id]);
    expect((await work.getVersionSnapshot(old.id)).openBugs).toEqual([]);
    await expect(
      work.deleteVersion(next.id, { confirmation: next.name, reason: '清理' }),
    ).rejects.toThrow('目标修复 Bug');
    await work.updateBugStatus(bug.id, {
      status: 'canceled',
      reason: '无需修复',
    });
    const snapshot = await work.getVersionSnapshot(next.id);
    expect(snapshot.metrics.openBugs).toBe(0);
    expect(snapshot.openBugs).toEqual([]);
  });

  it('preserves original version context through moves, renames and retirement', async () => {
    const project = await work.createProject({
      key: 'EVENTS',
      name: '历史上下文',
    });
    const old = await work.createVersion(project.id, { name: '1.0' });
    const next = await work.createVersion(project.id, { name: '2.0' });
    const requirement = await work.createRequirement({
      projectId: project.id,
      versionId: old.id,
      title: '原始名称',
      stages: [],
    });
    await work.moveRequirement(requirement.id, {
      versionId: next.id,
      reason: '延期',
    });
    await work.updateRequirement(requirement.id, { title: '新名称' });
    await work.deleteVersion(old.id, {
      confirmation: old.name,
      reason: '移空',
    });
    const before = await work.getChanges({
      since: '2020-01-01',
      versionId: old.id,
    });
    expect(
      before.find((item) => item.type === 'requirement_created'),
    ).toMatchObject({
      requirement: { title: '原始名称' },
      version: { id: old.id },
      contextAccuracy: 'recorded',
    });
    expect(
      before.find((item) => item.type === 'requirement_version_changed'),
    ).toMatchObject({
      version: { id: next.id },
      relatedVersion: { id: old.id },
    });
    expect(before.some((item) => item.entityId === next.id)).toBe(false);
    const after = await work.getChanges({
      since: '2020-01-01',
      versionId: next.id,
    });
    expect(after.some((item) => item.type === 'requirement_created')).toBe(
      false,
    );
    expect(
      (await work.getVersionSnapshot(next.id)).recentChanges.every(
        (item) =>
          item.version?.id === next.id || item.relatedVersion?.id === next.id,
      ),
    ).toBe(true);
  });

  it('requires the actual release date on both creation and final edited state', async () => {
    const project = await work.createProject({
      key: 'RELEASE',
      name: '发布校验',
    });
    await expect(
      work.createVersion(project.id, { name: 'invalid', status: 'released' }),
    ).rejects.toThrow('实际发布日期');
    const version = await work.createVersion(project.id, {
      name: '1.0',
      status: 'released',
      actualReleaseAt: '2026-09-05T00:00:00Z',
    });
    await expect(
      work.updateVersion(version.id, { actualReleaseAt: null, reason: '清空' }),
    ).rejects.toThrow('实际发布日期');
    expect((await work.listVersions(project.id))[0]?.actualReleaseAt).toBe(
      '2026-09-05T00:00:00.000Z',
    );
  });

  it('loads only scoped history once for a project snapshot', async () => {
    const project = await work.createProject({
      key: 'QUERIES',
      name: '查询范围',
    });
    for (let i = 0; i < 3; i++)
      await work.createRequirement({
        projectId: project.id,
        title: `需求 ${i}`,
        stages: [{ name: '开发' }],
      });
    const spy = vi.spyOn(ds.getRepository(StatusHistoryEntity), 'find');
    await work.getProjectSnapshot(project.id);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]?.where).toHaveProperty('entityId');
    spy.mockRestore();
  });

  it.skipIf(!process.env.FLOWTRACE_TEST_DATABASE_URL)(
    'serializes retirement against a concurrent move on PostgreSQL',
    async () => {
      const project = await work.createProject({
        key: 'RACE',
        name: '并发版本',
      });
      const version = await work.createVersion(project.id, { name: '1.0' });
      const requirement = await work.createRequirement({
        projectId: project.id,
        title: '待排期',
        stages: [],
      });
      const runner = ds.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      const scoped = (
        work as unknown as {
          scopedTo(manager: typeof runner.manager): WorkService;
        }
      ).scopedTo(runner.manager);
      await runner.manager
        .getRepository(VersionEntity)
        .findOne({
          where: { id: version.id },
          lock: { mode: 'pessimistic_write' },
        });
      const deletion = work.deleteVersion(version.id, {
        confirmation: version.name,
        reason: '清理',
      });
      const rejected = expect(deletion).rejects.toThrow('仍有 1 个需求');
      try {
        await scoped.moveRequirement(requirement.id, {
          versionId: version.id,
          reason: '排入',
        });
        await runner.commitTransaction();
        await rejected;
      } finally {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await runner.release();
      }
      expect(
        (await work.listVersions(project.id)).map((item) => item.id),
      ).toContain(version.id);
    },
  );
});
