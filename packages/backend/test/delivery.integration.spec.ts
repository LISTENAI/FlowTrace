import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { DomainModule } from '@/domain/domain.module';
import { WorkService } from '@/domain/work.service';
import {
  ChangeEventEntity,
  VersionEntity,
  StatusHistoryEntity,
} from '@/database/entities';
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

  it('pages through equal timestamps without omission and binds cursors to their scope', async () => {
    const project = await work.createProject({
      key: 'PAGES',
      name: '完整历史',
    });
    for (let index = 0; index < 6; index++)
      await work.createRequirement({
        projectId: project.id,
        title: `分页 ${index}`,
        stages: [],
      });
    await ds
      .getRepository(ChangeEventEntity)
      .update(
        { projectId: project.id },
        { occurredAt: new Date('2026-08-01T00:00:00Z') },
      );
    const all: string[] = [];
    let cursor: string | undefined;
    let until: string | undefined;
    do {
      const page = await work.getChangesPage({
        since: '2026-07-01',
        projectId: project.id,
        limit: 2,
        cursor,
        until,
      });
      all.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
      until = page.until;
      if (all.length === 2) {
        await expect(
          work.getChangesPage({
            since: '2026-06-01',
            projectId: project.id,
            cursor,
          }),
        ).rejects.toThrow('查询范围');
        await work.createRequirement({
          projectId: project.id,
          title: '翻页后新增',
          stages: [],
        });
      }
    } while (cursor);
    expect(all).toHaveLength(7);
    expect(new Set(all).size).toBe(7);
    const first = await work.searchPage('分页', ['requirement'], 2, false, {
      projectId: project.id,
    });
    expect(first).toMatchObject({ total: 6, hasMore: true, nextOffset: 2 });
    const second = await work.searchPage('分页', ['requirement'], 2, false, {
      projectId: project.id,
      offset: first.nextOffset,
    });
    expect(
      second.items.every(
        (item) => !first.items.some((prior) => prior.id === item.id),
      ),
    ).toBe(true);
  });

  it('clears personal attention after facts change and keeps coordination separate', async () => {
    const person = await work.createPerson({ name: '关注事项负责人' });
    const other = await work.createPerson({ name: '其他负责人' });
    const action = await work.createActionItem(
      { title: '确认样件', ownerIds: [person.id] },
      person.id,
    );
    await work.updateActionItemStatus(action.id, {
      status: 'waiting',
      statusReason: '等待样件',
      expectedResumeAt: '2020-01-01T00:00:00Z',
    });
    const project = await work.createProject({
      key: 'ATTENTION',
      name: '协调职责',
    });
    const requirement = await work.createRequirement({
      projectId: project.id,
      title: '联调验收',
      ownerIds: [person.id],
      stages: [{ name: '联调', ownerIds: [other.id] }],
    });
    await work.updateStageStatus(requirement.stages[0]!.id, {
      status: 'blocked',
      statusReason: '方案未知',
    });
    const overview = await work.getPersonWork(person.id);
    expect(overview.attention[0]).toMatchObject({
      targetId: action.id,
      role: 'execution',
      reasons: [expect.objectContaining({ code: 'resume_overdue' })],
    });
    expect(overview.attention).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: requirement.id,
          role: 'coordination',
        }),
      ]),
    );
    expect(
      overview.items.some((item) => item.id === requirement.stages[0]!.id),
    ).toBe(false);
    await work.updateActionItemStatus(action.id, { status: 'done' });
    expect(
      (await work.getPersonWork(person.id)).attention.some(
        (item) => item.targetId === action.id,
      ),
    ).toBe(false);
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
    const check = await work.getVersionDeliveryCheck(next.id);
    expect(check.counts).toMatchObject({ requirements: 0, bugs: 1 });
    expect(check.items.find((item) => item.category === 'bugs')).toMatchObject({
      targetId: bug.id,
      requirementId: requirement.id,
    });
    await work.updateBugStatus(bug.id, { status: 'in_progress' });
    expect((await work.getVersionSnapshot(next.id)).reviewItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetId: bug.id, versionId: next.id }),
      ]),
    );
    expect(
      (await work.getVersionSnapshot(old.id)).reviewItems.some(
        (item) => item.targetId === bug.id,
      ),
    ).toBe(false);
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
      await runner.manager.getRepository(VersionEntity).findOne({
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
