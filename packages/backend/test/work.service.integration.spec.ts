import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { entities } from '@/database/entities';
import { InitialSchema1724428800000 } from '@/database/migrations/1724428800000-initial-schema';
import { DomainModule } from '@/domain/domain.module';
import { WorkService } from '@/domain/work.service';

describe.sequential('WorkService business rules', () => {
  let dataSource: DataSource;
  let work: WorkService;
  let appProjectId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities,
          migrations: [InitialSchema1724428800000],
          migrationsRun: true,
          synchronize: false,
        }),
        DomainModule,
      ],
    }).compile();
    dataSource = module.get(DataSource);
    work = module.get(WorkService);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('copies the current template without changing existing requirements', async () => {
    const project = await work.createProject({
      key: 'APP',
      name: '客户端',
      templateStages: [{ name: '设计' }, { name: '开发' }],
    });
    appProjectId = project.id;
    const first = await work.createRequirement({
      projectId: project.id,
      title: '旧需求',
    });

    await work.updateTemplate(project.id, {
      stages: [{ name: '验证' }],
    });
    const second = await work.createRequirement({
      projectId: project.id,
      title: '新需求',
    });

    expect(
      (await work.getRequirement(first.id)).stages.map((item) => item.name),
    ).toEqual(['设计', '开发']);
    expect(second.stages.map((item) => item.name)).toEqual(['验证']);
  });

  it('keeps backfilled status history ordered and calculates real durations', async () => {
    const requirement = (
      await work.listRequirements({ projectId: appProjectId })
    ).find((item) => item.title === '旧需求');
    expect(requirement).toBeDefined();
    const stage = (await work.getRequirement(requirement!.id)).stages[1]!;

    await work.updateStageStatus(stage.id, {
      status: 'in_progress',
      effectiveAt: '2026-01-02T09:00:00.000Z',
    });
    await work.updateStageStatus(stage.id, {
      status: 'done',
      effectiveAt: '2026-01-07T09:00:00.000Z',
    });
    await work.updateStageStatus(stage.id, {
      status: 'waiting',
      statusReason: '等待测试环境',
      effectiveAt: '2026-01-04T09:00:00.000Z',
    });
    await work.updateStageStatus(stage.id, {
      status: 'in_progress',
      effectiveAt: '2026-01-06T09:00:00.000Z',
    });

    const updated = (await work.getRequirement(requirement!.id)).stages[1]!;
    expect(updated.status).toBe('done');
    expect(updated.actualStartAt).toBe('2026-01-02T09:00:00.000Z');
    expect(updated.actualEndAt).toBe('2026-01-07T09:00:00.000Z');
    expect(updated.statusHistory.map((item) => item.fromStatus)).toEqual([
      undefined,
      'in_progress',
      'waiting',
      'in_progress',
    ]);
    const durations = work.calculateDurations(
      updated.statusHistory,
      new Date('2026-01-08T09:00:00.000Z'),
    );
    expect(durations.inProgressMs).toBe(3 * 24 * 60 * 60 * 1000);
    expect(durations.waitingMs).toBe(2 * 24 * 60 * 60 * 1000);
  });

  it('requires a reason for waiting and blocked states', async () => {
    const requirement = (
      await work.listRequirements({ projectId: appProjectId })
    )[0]!;
    const stage = (await work.getRequirement(requirement.id)).stages[0]!;
    await expect(
      work.updateStageStatus(stage.id, { status: 'blocked' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('retains the initial schedule and every later adjustment', async () => {
    const requirement = (
      await work.listRequirements({ projectId: appProjectId })
    )[0]!;
    const stage = (await work.getRequirement(requirement.id)).stages[0]!;
    await work.rescheduleStage(stage.id, {
      plannedStartAt: '2026-02-01T00:00:00.000Z',
      plannedEndAt: '2026-02-05T00:00:00.000Z',
    });
    await work.rescheduleStage(stage.id, {
      plannedEndAt: '2026-02-08T00:00:00.000Z',
      reason: '联调资源延迟',
    });
    const updated = (await work.getRequirement(requirement.id)).stages[0]!;
    expect(updated.baselineEndAt).toBe('2026-02-05T00:00:00.000Z');
    expect(updated.plannedEndAt).toBe('2026-02-08T00:00:00.000Z');
    expect(updated.scheduleHistory).toHaveLength(2);
    expect(updated.scheduleHistory[1]?.oldEndAt).toBe(
      '2026-02-05T00:00:00.000Z',
    );
  });

  it('moves versions with history and keeps the requirement key stable', async () => {
    const project = (await work.listProjects()).find(
      (item) => item.key === 'APP',
    )!;
    const [v1, v2] = await Promise.all([
      work.createVersion(project.id, { name: '1.0' }),
      work.createVersion(project.id, { name: '2.0' }),
    ]);
    const requirement = await work.createRequirement({
      projectId: project.id,
      versionId: v1.id,
      title: '版本迁移需求',
    });
    const moved = await work.moveRequirement(requirement.id, {
      versionId: v2.id,
      reason: '交付窗口调整',
      source: 'agent',
      agentName: '测试 Agent',
    });
    expect(moved.key).toBe(requirement.key);
    expect(moved.versionHistory[0]).toMatchObject({
      fromVersionId: v1.id,
      toVersionId: v2.id,
      source: 'agent',
      agentName: '测试 Agent',
    });
  });

  it('allows cross-project reciprocal collaboration and only reports satisfaction', async () => {
    const hardware = await work.createProject({
      key: 'BOARD',
      name: '硬件板卡',
      templateStages: [{ name: '首次打样' }],
    });
    const firmware = await work.createProject({
      key: 'FIRM',
      name: '设备固件',
      templateStages: [{ name: '板上验证' }],
    });
    const boardRequirement = await work.createRequirement({
      projectId: hardware.id,
      title: '核心板改版',
    });
    const firmwareRequirement = await work.createRequirement({
      projectId: firmware.id,
      title: '新板适配',
    });
    const first = await work.addDependency({
      successorType: 'stage',
      successorId: firmwareRequirement.stages[0]!.id,
      predecessorType: 'stage',
      predecessorId: boardRequirement.stages[0]!.id,
    });
    const reciprocal = await work.addDependency({
      successorType: 'requirement',
      successorId: boardRequirement.id,
      predecessorType: 'requirement',
      predecessorId: firmwareRequirement.id,
      note: '后续改版依据固件验证结论',
    });
    expect(first.satisfied).toBe(false);
    expect(reciprocal.active).toBe(true);
    expect(reciprocal.predecessor?.projectName).toBe('设备固件');
  });

  it('prevents deleting work that already has history', async () => {
    const requirement = (
      await work.listRequirements({ projectId: appProjectId })
    )[0]!;
    const stage = (await work.getRequirement(requirement.id)).stages[0]!;
    await expect(work.deleteStage(stage.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
