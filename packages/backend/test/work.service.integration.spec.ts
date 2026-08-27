import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { entities } from '@/database/entities';
import { InitialSchema1724428800000 } from '@/database/migrations/1724428800000-initial-schema';
import { ProjectRhythms1724515200000 } from '@/database/migrations/1724515200000-project-rhythms';
import { SoftDeleteWorkItems1724601600000 } from '@/database/migrations/1724601600000-soft-delete-work-items';
import { VersionSortOrder1724688000000 } from '@/database/migrations/1724688000000-version-sort-order';
import { AiChangeContext1724774400000 } from '@/database/migrations/1724774400000-ai-change-context';
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
          migrations: [
            InitialSchema1724428800000,
            ProjectRhythms1724515200000,
            SoftDeleteWorkItems1724601600000,
            VersionSortOrder1724688000000,
            AiChangeContext1724774400000,
          ],
          migrationsRun: true,
          synchronize: false,
        }),
        DomainModule,
      ],
    }).compile();
    dataSource = module.get(DataSource);
    work = module.get(WorkService);
  });

  it('maintains reusable project rhythms without linking existing projects', async () => {
    const rhythm = await work.createProjectRhythm({
      name: '算法研究',
      description: '适合实验性项目',
      stages: [{ name: '假设' }, { name: '实验' }, { name: '复现' }],
    });
    const project = await work.createProject({
      key: 'LAB',
      name: '声学实验室',
      templateStages: rhythm.stages,
    });
    await work.updateProjectRhythm(rhythm.id, {
      stages: [{ name: '探索' }, { name: '验证' }],
    });

    expect((await work.getProject(project.id)).templateStages).toHaveLength(3);
    expect((await work.listProjectRhythms())[0]?.stages).toHaveLength(2);
    await work.deleteProjectRhythm(rhythm.id);
    expect(await work.listProjectRhythms()).toHaveLength(0);
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

    const custom = await work.createRequirement({
      projectId: project.id,
      title: '按实际计划创建',
      stages: [
        {
          name: '物料报价',
          ownerIds: ['owner-a'],
          plannedEndAt: '2026-08-28T10:00:00.000Z',
        },
        { name: '采购下单', note: '报价齐套后开始' },
      ],
    });
    expect(custom.stages).toEqual([
      expect.objectContaining({
        name: '物料报价',
        order: 0,
        ownerIds: ['owner-a'],
        baselineEndAt: '2026-08-28T10:00:00.000Z',
        plannedEndAt: '2026-08-28T10:00:00.000Z',
      }),
      expect.objectContaining({
        name: '采购下单',
        order: 1,
        note: '报价齐套后开始',
      }),
    ]);
  });

  it('keeps valid template dependencies when stages are edited during creation', async () => {
    const project = await work.createProject({
      key: 'INLINE',
      name: '创建时维护流程',
      templateStages: [
        { id: 'design', name: '方案设计' },
        {
          id: 'develop',
          name: '开发',
          dependsOnTemplateStageIds: ['design'],
        },
      ],
    });

    const requirement = await work.createRequirement({
      projectId: project.id,
      title: '直接编辑默认流程',
      stages: [
        {
          templateStageId: 'design',
          name: '技术方案',
          ownerIds: ['architect'],
        },
        {
          templateStageId: 'develop',
          name: '研发实现',
          plannedStartAt: '2026-09-01T00:00:00.000Z',
        },
      ],
    });

    expect(requirement.stages).toEqual([
      expect.objectContaining({
        name: '技术方案',
        ownerIds: ['architect'],
      }),
      expect.objectContaining({
        name: '研发实现',
        plannedStartAt: '2026-09-01T00:00:00.000Z',
      }),
    ]);
    expect(await work.listDependencies(requirement.id)).toEqual([
      expect.objectContaining({
        predecessorId: requirement.stages[0]!.id,
        successorId: requirement.stages[1]!.id,
        active: true,
      }),
    ]);
  });

  it('assigns requirement, stage and bug owners independently after creation', async () => {
    const [coordinator, designer, developer] = await Promise.all([
      work.createPerson({ name: '协调人' }),
      work.createPerson({ name: '设计负责人' }),
      work.createPerson({ name: '开发负责人' }),
    ]);
    const project = await work.createProject({
      key: 'OWNERS',
      name: '负责人验证',
      templateStages: [{ name: '需求设计' }, { name: '开发' }],
    });
    const requirement = await work.createRequirement({
      projectId: project.id,
      title: '验证独立分配',
      ownerIds: [coordinator.id],
    });

    expect(requirement.ownerIds).toEqual([coordinator.id]);
    expect(requirement.stages.map((stage) => stage.ownerIds)).toEqual([[], []]);

    await work.updateStageStatus(requirement.stages[0]!.id, {
      status: 'in_progress',
      ownerIds: [coordinator.id, designer.id],
    });
    const bug = await work.reportBug(requirement.id, {
      title: '联调异常',
      ownerIds: [developer.id],
    });
    await work.updateBugStatus(bug.id, {
      status: 'in_progress',
      ownerIds: [designer.id],
    });
    await work.updateStageStatus(requirement.stages[0]!.id, {
      status: 'in_progress',
      ownerIds: [developer.id],
    });

    const updated = await work.getRequirement(requirement.id);
    expect(updated.stages[0]!.ownerIds).toEqual([developer.id]);
    expect(updated.stages[0]!.status).toBe('in_progress');
    expect(updated.bugs[0]!.ownerIds).toEqual([designer.id]);
    expect(updated.bugs[0]!.status).toBe('in_progress');
    const changes = await work.getChanges({
      since: '2020-01-01T00:00:00.000Z',
      requirementId: requirement.id,
    });
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'stage_updated',
          summary: '需求设计 更新负责人',
        }),
      ]),
    );
  });

  it('inserts and reorders actual stages without duplicate positions', async () => {
    const project = await work.createProject({
      key: 'ORDER',
      name: '过程顺序验证',
      templateStages: [{ name: '设计' }, { name: '开发' }, { name: '测试' }],
    });
    const requirement = await work.createRequirement({
      projectId: project.id,
      title: '验证阶段排序',
    });

    await work.addStage(requirement.id, { name: '评审', order: 1 });
    const inserted = await work.getRequirement(requirement.id);
    expect(inserted.stages.map((stage) => stage.name)).toEqual([
      '设计',
      '评审',
      '开发',
      '测试',
    ]);
    expect(inserted.stages.map((stage) => stage.order)).toEqual([0, 1, 2, 3]);

    const testing = inserted.stages.find((stage) => stage.name === '测试')!;
    await work.updateStage(testing.id, { order: 1 });
    const reordered = await work.getRequirement(requirement.id);
    expect(reordered.stages.map((stage) => stage.name)).toEqual([
      '设计',
      '测试',
      '评审',
      '开发',
    ]);
    expect(reordered.stages.map((stage) => stage.order)).toEqual([0, 1, 2, 3]);
  });

  it('soft deletes requirements and stages after explicit confirmation', async () => {
    const project = await work.createProject({
      key: 'DELETE',
      name: '删除验证',
      templateStages: [{ name: '需求评审' }, { name: '开发' }],
    });
    const requirement = await work.createRequirement({
      projectId: project.id,
      title: '误建需求',
    });
    const review = requirement.stages[0]!;
    await work.updateStageStatus(review.id, { status: 'in_progress' });

    await expect(
      work.deleteStage(review.id, {
        confirmation: '错误名称',
        reason: '测试误操作保护',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await work.deleteStage(review.id, {
      confirmation: review.name,
      reason: '阶段建错',
    });

    const afterStageDelete = await work.getRequirement(requirement.id);
    expect(afterStageDelete.stages.map((item) => item.name)).toEqual(['开发']);
    expect(
      await dataSource.getRepository('status_history').countBy({
        entityType: 'stage',
        entityId: review.id,
      }),
    ).toBe(1);

    await work.deleteRequirement(requirement.id, {
      confirmation: requirement.key,
      reason: '需求重复创建',
    });
    expect(
      (await work.listRequirements({ projectId: project.id })).map(
        (item) => item.id,
      ),
    ).not.toContain(requirement.id);
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

  it('backfills and corrects actual start and end times without duplicate status events', async () => {
    const requirement = (
      await work.listRequirements({ projectId: appProjectId })
    ).find((item) => item.title === '旧需求')!;
    const stage = (await work.getRequirement(requirement.id)).stages[0]!;

    await work.updateStageStatus(stage.id, {
      status: 'done',
      actualStartAt: '2026-01-10T09:00:00.000Z',
      actualEndAt: '2026-01-12T18:00:00.000Z',
    });
    await work.updateStageStatus(stage.id, {
      status: 'done',
      actualStartAt: '2026-01-10T10:00:00.000Z',
      actualEndAt: '2026-01-12T17:00:00.000Z',
    });

    const updated = (await work.getRequirement(requirement.id)).stages[0]!;
    expect(updated.actualStartAt).toBe('2026-01-10T10:00:00.000Z');
    expect(updated.actualEndAt).toBe('2026-01-12T17:00:00.000Z');
    expect(updated.statusHistory.map((item) => item.toStatus)).toEqual([
      'in_progress',
      'done',
    ]);

    const pointRequirement = await work.createRequirement({
      projectId: appProjectId,
      title: '单日节点',
    });
    const pointStage = pointRequirement.stages[0]!;
    await work.updateStageStatus(pointStage.id, {
      status: 'done',
      actualStartAt: '2026-01-15T18:00:00.000Z',
      actualEndAt: '2026-01-15T18:00:00.000Z',
    });
    const pointUpdated = (await work.getRequirement(pointRequirement.id))
      .stages[0]!;
    expect(pointUpdated.status).toBe('done');
    expect(pointUpdated.actualStartAt).toBe('2026-01-15T18:00:00.000Z');
    expect(pointUpdated.actualEndAt).toBe('2026-01-15T18:00:00.000Z');
    expect(pointUpdated.statusHistory.map((item) => item.toStatus)).toEqual([
      'in_progress',
      'done',
    ]);
  });

  it('keeps waiting current when actual start is backfilled at the same time', async () => {
    const requirement = await work.createRequirement({
      projectId: appProjectId,
      title: '等待状态与实际开始一致性',
      stages: [{ name: '采购流程' }],
    });
    const effectiveAt = '2026-08-27T09:00:00.000Z';
    await work.updateStageStatus(requirement.stages[0]!.id, {
      status: 'waiting',
      statusReason: '等待全部报价确认',
      effectiveAt,
      actualStartAt: effectiveAt,
    });

    const stage = (await work.getRequirement(requirement.id)).stages[0]!;
    expect(stage.status).toBe('waiting');
    expect(stage.statusReason).toBe('等待全部报价确认');
    expect(stage.actualStartAt).toBe(effectiveAt);
    expect(stage.statusHistory.map((item) => item.toStatus)).toEqual([
      'in_progress',
      'waiting',
    ]);
  });

  it('corrects one named history event and keeps a before-and-after audit', async () => {
    const requirement = await work.createRequirement({
      projectId: appProjectId,
      title: '历史修正审计',
    });
    const stage = requirement.stages[0]!;
    await work.updateStageStatus(stage.id, {
      status: 'in_progress',
      effectiveAt: '2026-01-10T09:00:00.000Z',
    });
    const history = (await work.getRequirement(requirement.id)).stages[0]!
      .statusHistory[0]!;

    await work.correctStatusHistory(history.id, {
      effectiveAt: '2026-01-09T09:00:00.000Z',
      reason: '根据邮件时间修正',
      source: 'agent',
      agentName: '验收 Agent',
    });

    const updated = (await work.getRequirement(requirement.id)).stages[0]!;
    expect(updated.actualStartAt).toBe('2026-01-09T09:00:00.000Z');
    const changes = await work.getChanges({
      since: '2020-01-01T00:00:00.000Z',
      requirementId: requirement.id,
    });
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'stage_status_history_corrected',
          reason: '根据邮件时间修正',
          source: 'agent',
          agentName: '验收 Agent',
          details: expect.objectContaining({
            historyId: history.id,
            before: expect.objectContaining({
              effectiveAt: '2026-01-10T09:00:00.000Z',
            }),
            after: expect.objectContaining({
              effectiveAt: '2026-01-09T09:00:00.000Z',
            }),
          }),
        }),
      ]),
    );
  });

  it('rejects an actual end before the actual start', async () => {
    const requirement = (
      await work.listRequirements({ projectId: appProjectId })
    ).find((item) => item.title === '旧需求')!;
    const stage = (await work.getRequirement(requirement.id)).stages[0]!;

    await expect(
      work.updateStageStatus(stage.id, {
        status: 'done',
        actualStartAt: '2026-01-13T09:00:00.000Z',
        actualEndAt: '2026-01-12T09:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
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

  it('shows the stage needing the most attention as the current stage', async () => {
    const owner = await work.createPerson({ name: '验证负责人' });
    await work.updateTemplate(appProjectId, {
      stages: [{ name: '准备' }, { name: '开发' }, { name: '验证' }],
    });
    const requirement = await work.createRequirement({
      projectId: appProjectId,
      title: '并行推进需求',
    });
    await work.updateStageStatus(requirement.stages[1]!.id, {
      status: 'in_progress',
    });
    await work.updateStageStatus(requirement.stages[2]!.id, {
      status: 'blocked',
      statusReason: '等待样件',
      ownerIds: [owner.id],
    });
    await work.rescheduleStage(requirement.stages[2]!.id, {
      plannedStartAt: '2026-02-01T00:00:00.000Z',
      plannedEndAt: '2026-02-05T00:00:00.000Z',
    });

    const summary = (
      await work.listRequirements({ projectId: appProjectId })
    ).find((item) => item.id === requirement.id);
    expect(summary).toMatchObject({
      currentStage: '验证',
      currentStageId: requirement.stages[2]!.id,
      currentStageStatus: 'blocked',
      currentStageOwnerIds: [owner.id],
      currentStagePlannedStartAt: '2026-02-01T00:00:00.000Z',
      currentStagePlannedEndAt: '2026-02-05T00:00:00.000Z',
      activeStages: [
        expect.objectContaining({ name: '开发', status: 'in_progress' }),
        expect.objectContaining({ name: '验证', status: 'blocked' }),
      ],
      nextStages: [],
    });
    expect(summary?.reviewIssues.map((issue) => issue.code)).toEqual([
      'requirement_owner_missing',
      'version_missing',
      'work_owner_missing',
      'work_plan_missing',
    ]);
  });

  it('accepts a process-only requirement until scheduling actually begins', async () => {
    const owner = await work.createPerson({ name: '过程负责人' });
    const requirement = await work.createRequirement({
      projectId: appProjectId,
      title: '仅记录实际过程',
      ownerIds: [owner.id],
    });
    await work.updateStageStatus(requirement.stages[0]!.id, {
      status: 'in_progress',
      ownerIds: [owner.id],
    });

    const beforePlanning = (
      await work.listRequirements({ projectId: appProjectId })
    ).find((item) => item.id === requirement.id);
    expect(
      beforePlanning?.reviewIssues.map((issue) => issue.code),
    ).not.toContain('work_plan_missing');

    await work.rescheduleRequirement(requirement.id, {
      plannedEndAt: '2026-02-08T00:00:00.000Z',
      reason: '开始安排整体交付时间',
    });
    const afterPlanning = (
      await work.listRequirements({ projectId: appProjectId })
    ).find((item) => item.id === requirement.id);
    expect(afterPlanning?.reviewIssues.map((issue) => issue.code)).toContain(
      'work_plan_missing',
    );
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
      effectiveAt: '2026-03-02T09:30:00.000Z',
      source: 'agent',
      agentName: '测试 Agent',
    });
    expect(moved.key).toBe(requirement.key);
    expect(moved.versionHistory[0]).toMatchObject({
      fromVersionId: v1.id,
      toVersionId: v2.id,
      source: 'agent',
      agentName: '测试 Agent',
      effectiveAt: '2026-03-02T09:30:00.000Z',
    });
  });

  it('keeps versions in the manually maintained order', async () => {
    const project = await work.createProject({
      key: 'VORDER',
      name: '版本排序验证',
      templateStages: [{ name: '开发' }],
    });
    const first = await work.createVersion(project.id, { name: '先行版本' });
    const second = await work.createVersion(project.id, { name: '后续版本' });

    await work.updateVersion(first.id, { sortOrder: 1 });
    await work.updateVersion(second.id, { sortOrder: 0 });

    expect(
      (await work.listVersions(project.id)).map((item) => item.name),
    ).toEqual(['后续版本', '先行版本']);
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

  it('searches or lists stable objects with enough project context', async () => {
    const [firstProject, secondProject, inactivePerson] = await Promise.all([
      work.createProject({
        key: 'SEARCH-A',
        name: '搜索项目甲',
        templateStages: [{ name: '开发' }],
      }),
      work.createProject({
        key: 'SEARCH-B',
        name: '搜索项目乙',
        templateStages: [{ name: '验证' }],
      }),
      work.createPerson({ name: '暂停协作者' }),
    ]);
    await work.updatePerson(inactivePerson.id, { active: false });
    await Promise.all([
      work.createVersion(firstProject.id, { name: '试运行' }),
      work.createVersion(secondProject.id, { name: '试运行' }),
      work.createVersion(firstProject.id, { name: '2.7' }),
    ]);

    const versions = await work.search('试运行', ['version']);
    expect(versions).toHaveLength(2);
    expect(versions.map((item) => item.projectName).sort()).toEqual([
      '搜索项目乙',
      '搜索项目甲',
    ]);
    expect(await work.search('2.7.0-alpha.1', ['version'])).toEqual([
      expect.objectContaining({ name: '2.7', projectName: '搜索项目甲' }),
    ]);
    expect(await work.search('', ['project'], 50)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstProject.id, type: 'project' }),
        expect.objectContaining({ id: secondProject.id, type: 'project' }),
      ]),
    );
    expect(await work.search('', ['person'], 50)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: inactivePerson.id,
          type: 'person',
          active: false,
        }),
      ]),
    );
  });

  it('returns explicit snapshot lists, requirement context and filtered changes', async () => {
    const [owner, project] = await Promise.all([
      work.createPerson({ name: '上下文负责人' }),
      work.createProject({
        key: 'CONTEXT',
        name: '上下文验证',
        templateStages: [{ name: '方案评审' }],
      }),
    ]);
    const version = await work.createVersion(project.id, { name: '1.0' });
    const predecessor = await work.createRequirement({
      projectId: project.id,
      versionId: version.id,
      title: '前置准备',
    });
    const requirement = await work.createRequirement({
      projectId: project.id,
      versionId: version.id,
      title: '上下文需求',
      ownerIds: [owner.id],
      plannedStartAt: '2026-01-01T00:00:00.000Z',
      plannedEndAt: '2026-01-02T00:00:00.000Z',
      source: 'agent',
      agentName: '集成验证',
    });
    await work.updateStageStatus(requirement.stages[0]!.id, {
      status: 'waiting',
      statusReason: '等待评审材料',
      ownerIds: [owner.id],
      source: 'agent',
      agentName: '集成验证',
    });
    await work.reportBug(requirement.id, {
      title: '评审记录缺失',
      ownerIds: [owner.id],
      source: 'agent',
      agentName: '集成验证',
    });
    const dependency = await work.addDependency({
      successorType: 'stage',
      successorId: requirement.stages[0]!.id,
      predecessorType: 'requirement',
      predecessorId: predecessor.id,
      source: 'agent',
      agentName: '集成验证',
    });

    const detail = await work.getRequirementDetail(requirement.key);
    expect(detail).toMatchObject({
      project: { id: project.id, name: '上下文验证' },
      version: { id: version.id, name: '1.0' },
    });
    expect(detail.people.map((item) => item.id)).toContain(owner.id);
    expect(detail.dependencies.map((item) => item.id)).toContain(dependency.id);

    const snapshot = await work.getVersionSnapshot(version.id);
    expect(snapshot.waitingItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementKey: requirement.key,
          reason: '等待评审材料',
        }),
      ]),
    );
    expect(snapshot.delayedItems.map((item) => item.id)).toContain(
      requirement.id,
    );
    expect(snapshot.openBugs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ requirementId: requirement.id, type: 'bug' }),
      ]),
    );
    expect(snapshot.reviewItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementId: requirement.id,
          requirementKey: requirement.key,
          targetName: '方案评审',
          code: 'work_plan_missing',
        }),
      ]),
    );

    await work.resolveDependency(dependency.id, {
      source: 'agent',
      agentName: '集成验证',
      reason: '改为并行推进',
    });
    const changes = await work.getChanges({
      since: '2020-01-01T00:00:00.000Z',
      requirementId: requirement.id,
    });
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'dependency_removed',
          reason: '改为并行推进',
          project: expect.objectContaining({ name: '上下文验证' }),
          requirement: expect.objectContaining({ key: requirement.key }),
        }),
      ]),
    );
  });
});
