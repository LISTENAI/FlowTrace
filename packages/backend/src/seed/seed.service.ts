import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import type {
  Person,
  Project,
  Requirement,
  TemplateStage,
  Version,
  VersionStatus,
} from '@flowtrace/shared';
import { inferStageWorkDomain } from '@flowtrace/shared';
import { randomUUID } from 'node:crypto';
import { WorkService } from '@/domain/work.service';

const at = (offsetDays: number, hour = 9) => {
  const value = new Date();
  value.setHours(hour, 0, 0, 0);
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString();
};

const template = (names: string[]): TemplateStage[] => {
  const ids = names.map(() => randomUUID());
  return names.map((name, order) => ({
    id: ids[order] as string,
    name,
    workDomain: inferStageWorkDomain(name),
    order,
    ownerIds: [],
    dependsOnTemplateStageIds: order ? [ids[order - 1] as string] : [],
  }));
};

interface DemoVersionInput {
  status: VersionStatus;
  plannedStartAt: string;
  plannedReleaseAt: string;
  actualReleaseAt?: string;
  description: string;
}

interface DemoRequirementInput {
  versionId?: string;
  title: string;
  description: string;
  ownerIds: string[];
  plannedStartAt: string;
  plannedEndAt: string;
}

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(@Inject(WorkService) private readonly work: WorkService) {}

  async onApplicationBootstrap() {
    await this.seedProjectRhythms();
    if (process.env.FLOWTRACE_SEED_DEMO !== 'true') return;
    if ((await this.work.listProjects()).length) return;

    this.logger.log('正在初始化演示项目');
    await this.seed();
    await this.seedExperienceData();
  }

  private async seedProjectRhythms() {
    if ((await this.work.listProjectRhythms()).length) return;
    for (const input of [
      {
        name: '软件研发',
        description: '适合应用、服务与平台功能的持续交付',
        stages: ['需求设计', '开发', '联调', '测试', '上线'].map((name) => ({
          name,
        })),
      },
      {
        name: '固件研发',
        description: '覆盖方案、板上验证与设备版本发布',
        stages: [
          '需求确认',
          '方案设计',
          '开发',
          '板上验证',
          '测试',
          '发布',
        ].map((name) => ({ name })),
      },
      {
        name: '硬件研发',
        description: '覆盖设计、打样、验证与定版',
        stages: ['设计', '首次打样', '验证', '定版'].map((name) => ({ name })),
      },
    ]) {
      await this.work.createProjectRhythm(input);
    }
  }

  private async seed() {
    const [fw, qa, hw, svc] = await Promise.all([
      this.work.createPerson({ name: '阿沐', note: '固件研发' }),
      this.work.createPerson({ name: '小岑', note: '测试' }),
      this.work.createPerson({ name: '南乔', note: '硬件研发' }),
      this.work.createPerson({ name: '予安', note: '云端研发' }),
    ]);
    const source = { source: 'api' as const, reason: '初始化演示数据' };
    const [firmware, hardware, cloud] = await Promise.all([
      this.work.createProject({
        key: 'FW',
        name: '晴岚设备固件',
        description: '演示设备的固件开发、验证与版本发布',
        templateStages: template([
          '需求确认',
          '方案设计',
          '开发',
          '板上验证',
          '联调',
          '测试',
          '发布',
        ]),
        ...source,
      }),
      this.work.createProject({
        key: 'HW',
        name: '晴岚开发板',
        description: '硬件设计、打样与定版',
        templateStages: template(['设计', '首次打样', '验证', '定版']),
        ...source,
      }),
      this.work.createProject({
        key: 'CLOUD',
        name: '晴岚协作云',
        description: '云服务接口与设备协同能力',
        templateStages: template([
          '需求设计',
          '需求评审',
          '开发',
          '联调',
          '测试',
          '上线',
        ]),
        ...source,
      }),
    ]);

    const [fw28, fw30, hwRevB, cloud28] = await Promise.all([
      this.work.createVersion(firmware.id, {
        name: '2.8',
        status: 'active',
        plannedStartAt: at(-30),
        plannedReleaseAt: at(8),
        description: '配网稳定性与设备恢复能力',
        ...source,
      }),
      this.work.createVersion(firmware.id, {
        name: '3.0',
        status: 'planning',
        plannedStartAt: at(10),
        plannedReleaseAt: at(45),
        ...source,
      }),
      this.work.createVersion(hardware.id, {
        name: 'Rev B',
        status: 'active',
        plannedStartAt: at(-35),
        plannedReleaseAt: at(12),
        ...source,
      }),
      this.work.createVersion(cloud.id, {
        name: '2026.08',
        status: 'active',
        plannedStartAt: at(-25),
        plannedReleaseAt: at(5),
        ...source,
      }),
    ]);

    const board = await this.work.createRequirement({
      projectId: hardware.id,
      versionId: hwRevB.id,
      title: '原型板电源布局验证',
      description: '验证演示硬件在典型负载下的电气稳定性。',
      ownerIds: [hw.id],
      plannedStartAt: at(-22),
      plannedEndAt: at(4),
      ...source,
    });
    for (const [index, stage] of board.stages.entries()) {
      if (index < 2) {
        await this.work.updateStageStatus(stage.id, {
          status: 'in_progress',
          effectiveAt: at(-20 + index * 5),
          ...source,
        });
        await this.work.updateStageStatus(stage.id, {
          status: 'done',
          effectiveAt: at(-16 + index * 6),
          ...source,
        });
      }
    }
    const boardUpdated = await this.work.getRequirement(board.id);
    const validation = boardUpdated.stages.find((item) => item.name === '验证');
    if (validation) {
      await this.work.updateStageStatus(validation.id, {
        status: 'in_progress',
        effectiveAt: at(-7),
        ...source,
      });
    }

    const pairing = await this.work.createRequirement({
      projectId: firmware.id,
      versionId: fw28.id,
      title: '设备配网流程优化',
      description: '验证网络波动、重连和应用切换场景下的配置成功率。',
      ownerIds: [fw.id, qa.id],
      plannedStartAt: at(-18),
      plannedEndAt: at(-2),
      ...source,
    });
    const design = pairing.stages.find((item) => item.name === '方案设计');
    const development = pairing.stages.find((item) => item.name === '开发');
    const boardValidation = pairing.stages.find(
      (item) => item.name === '板上验证',
    );
    const integration = pairing.stages.find((item) => item.name === '联调');
    const testing = pairing.stages.find((item) => item.name === '测试');
    if (design) {
      await this.work.updateStageStatus(design.id, {
        status: 'in_progress',
        effectiveAt: at(-17),
        ...source,
      });
      await this.work.updateStageStatus(design.id, {
        status: 'done',
        effectiveAt: at(-14),
        ...source,
      });
    }
    if (development) {
      await this.work.updateStage(development.id, {
        ownerIds: [fw.id],
        ...source,
      });
      await this.work.updateStageStatus(development.id, {
        status: 'in_progress',
        effectiveAt: at(-13),
        ...source,
      });
      await this.work.updateStageStatus(development.id, {
        status: 'waiting',
        effectiveAt: at(-10),
        statusReason: '等待联调环境部署',
        expectedResumeAt: at(-8),
        ...source,
      });
      await this.work.updateStageStatus(development.id, {
        status: 'in_progress',
        effectiveAt: at(-8),
        note: '环境已就绪',
        ...source,
      });
      await this.work.updateStageStatus(development.id, {
        status: 'done',
        effectiveAt: at(-5),
        ...source,
      });
      await this.work.rescheduleStage(development.id, {
        plannedStartAt: at(-13),
        plannedEndAt: at(-4),
        ...source,
        reason: '联调环境比原计划晚两天可用',
      });
    }
    if (testing) {
      await this.work.updateStage(testing.id, { ownerIds: [qa.id], ...source });
      await this.work.updateStageStatus(testing.id, {
        status: 'in_progress',
        effectiveAt: at(-3),
        ...source,
      });
      await this.work.updateStageStatus(testing.id, {
        status: 'blocked',
        effectiveAt: at(-1),
        statusReason: '压力测试中偶现设备重启，原因尚未定位',
        ...source,
      });
    }
    const bug1 = await this.work.reportBug(pairing.id, {
      title: '重连后进度显示未刷新',
      ownerIds: [fw.id],
      discoveredStageId: testing?.id,
      targetVersionId: fw28.id,
      ...source,
    });
    await this.work.updateBugStatus(bug1.id, {
      status: 'in_progress',
      effectiveAt: at(-3, 14),
      ...source,
    });
    await this.work.updateBugStatus(bug1.id, {
      status: 'done',
      effectiveAt: at(-2, 18),
      ...source,
    });
    const bug2 = await this.work.reportBug(pairing.id, {
      title: '应用切换后台后偶现超时',
      ownerIds: [fw.id],
      discoveredStageId: testing?.id,
      targetVersionId: fw28.id,
      ...source,
    });
    await this.work.updateBugStatus(bug2.id, {
      status: 'in_progress',
      effectiveAt: at(-1, 11),
      ...source,
    });

    const cloudRequirement = await this.work.createRequirement({
      projectId: cloud.id,
      versionId: cloud28.id,
      title: '设备注册接口幂等处理',
      description: '为客户端重试提供稳定的幂等处理。',
      ownerIds: [svc.id],
      plannedStartAt: at(-10),
      plannedEndAt: at(2),
      ...source,
    });
    const cloudDevelopment = cloudRequirement.stages.find(
      (item) => item.name === '开发',
    );
    if (cloudDevelopment) {
      await this.work.updateStageStatus(cloudDevelopment.id, {
        status: 'in_progress',
        effectiveAt: at(-8),
        ...source,
      });
      await this.work.updateStageStatus(cloudDevelopment.id, {
        status: 'waiting',
        effectiveAt: at(-1),
        statusReason: '等待接口评审确认幂等键保留策略',
        expectedResumeAt: at(1),
        ...source,
      });
    }

    if (boardValidation && boardUpdated.stages[1]) {
      await this.work.addDependency({
        successorType: 'stage',
        successorId: boardValidation.id,
        predecessorType: 'stage',
        predecessorId: boardUpdated.stages[1].id,
        note: '样板完成后即可开始板上验证',
        ...source,
      });
    }
    if (integration && cloudDevelopment) {
      await this.work.addDependency({
        successorType: 'stage',
        successorId: integration.id,
        predecessorType: 'stage',
        predecessorId: cloudDevelopment.id,
        note: '依赖服务端幂等注册接口',
        ...source,
      });
    }

    await this.work.createRequirement({
      projectId: firmware.id,
      versionId: fw30.id,
      title: '设备安全恢复流程',
      description: '增加异常启动计数与受控恢复入口。',
      ownerIds: [fw.id],
      plannedStartAt: at(12),
      plannedEndAt: at(32),
      ...source,
    });
  }

  private async seedExperienceData() {
    const projects = await this.work.listProjects();
    const firmware = projects.find((item) => item.key === 'FW');
    const hardware = projects.find((item) => item.key === 'HW');
    const cloud = projects.find((item) => item.key === 'CLOUD');
    if (!firmware || !hardware || !cloud) return;

    const source = { source: 'api' as const, reason: '初始化演示数据' };
    const people = await this.work.listPeople(true);
    const ensurePerson = async (
      name: string,
      note: string,
    ): Promise<Person> => {
      const existing = people.find((item) => item.name === name);
      if (existing) return existing;
      const created = await this.work.createPerson({ name, note });
      people.push(created);
      return created;
    };
    const [fw, qa, hw, svc, pm, algo, app] = await Promise.all([
      ensurePerson('阿沐', '固件研发'),
      ensurePerson('小岑', '测试与质量'),
      ensurePerson('南乔', '硬件研发'),
      ensurePerson('予安', '云端研发'),
      ensurePerson('青禾', '产品与项目协同'),
      ensurePerson('知遥', '声学算法'),
      ensurePerson('向晚', '应用与工具开发'),
    ]);

    const versionCache = new Map<string, Version[]>();
    const ensureVersion = async (
      project: Project,
      name: string,
      input: DemoVersionInput,
    ): Promise<Version> => {
      const versions =
        versionCache.get(project.id) ??
        (await this.work.listVersions(project.id));
      versionCache.set(project.id, versions);
      const existing = versions.find((item) => item.name === name);
      if (existing) return existing;
      let created = await this.work.createVersion(project.id, {
        name,
        status: input.status,
        plannedStartAt: input.plannedStartAt,
        plannedReleaseAt: input.plannedReleaseAt,
        description: input.description,
        ...source,
      });
      if (input.actualReleaseAt) {
        created = await this.work.updateVersion(created.id, {
          actualReleaseAt: input.actualReleaseAt,
          ...source,
        });
      }
      versions.push(created);
      return created;
    };

    const [, fw28, fw30, hwRevB, hwRevC, cloudAugust, cloudSeptember] =
      await Promise.all([
        ensureVersion(firmware, '2.7', {
          status: 'released',
          plannedStartAt: at(-75),
          plannedReleaseAt: at(-38),
          actualReleaseAt: at(-36, 16),
          description: '稳定演示版本，保留用于历史问题回溯',
        }),
        ensureVersion(firmware, '2.8', {
          status: 'active',
          plannedStartAt: at(-30),
          plannedReleaseAt: at(8),
          description: '连接稳定性、分包更新与交互体验改进',
        }),
        ensureVersion(firmware, '3.0', {
          status: 'planning',
          plannedStartAt: at(10),
          plannedReleaseAt: at(45),
          description: '安全恢复与资源动态切换能力',
        }),
        ensureVersion(hardware, 'Rev B', {
          status: 'active',
          plannedStartAt: at(-35),
          plannedReleaseAt: at(12),
          description: '电源、接口与采集样件验证',
        }),
        ensureVersion(hardware, 'Rev C', {
          status: 'planning',
          plannedStartAt: at(4),
          plannedReleaseAt: at(42),
          description: '器件替代与小批量验证版本',
        }),
        ensureVersion(cloud, '2026.08', {
          status: 'active',
          plannedStartAt: at(-25),
          plannedReleaseAt: at(5),
          description: '设备协同、分包更新与在线状态服务',
        }),
        ensureVersion(cloud, '2026.09', {
          status: 'planning',
          plannedStartAt: at(7),
          plannedReleaseAt: at(38),
          description: '资源模型分发与告警订阅',
        }),
      ]);
    const requirementCache = new Map<string, Map<string, string>>();
    const getRequirementIndex = async (project: Project) => {
      const cached = requirementCache.get(project.id);
      if (cached) return cached;
      const rows = await this.work.listRequirements({ projectId: project.id });
      const index = new Map(rows.map((item) => [item.title, item.id]));
      requirementCache.set(project.id, index);
      return index;
    };
    const ensureRequirement = async (
      project: Project,
      input: DemoRequirementInput,
      configure: (requirement: Requirement) => Promise<void>,
    ): Promise<Requirement> => {
      const index = await getRequirementIndex(project);
      const existingId = index.get(input.title);
      if (existingId) return this.work.getRequirement(existingId);
      const created = await this.work.createRequirement({
        projectId: project.id,
        ...input,
        ...source,
      });
      index.set(input.title, created.id);
      await this.scheduleStages(
        created,
        input.plannedStartAt,
        input.plannedEndAt,
      );
      await configure(created);
      return this.work.getRequirement(created.id);
    };

    const completeStage = async (
      requirement: Requirement,
      name: string,
      ownerIds: string[],
      startedAt: string,
      completedAt: string,
    ) => {
      const stage = this.findStage(requirement, name);
      await this.work.updateStage(stage.id, { ownerIds, ...source });
      await this.work.updateStageStatus(stage.id, {
        status: 'in_progress',
        effectiveAt: startedAt,
        ...source,
      });
      await this.work.updateStageStatus(stage.id, {
        status: 'done',
        effectiveAt: completedAt,
        ...source,
      });
    };
    const startStage = async (
      requirement: Requirement,
      name: string,
      ownerIds: string[],
      effectiveAt: string,
    ) => {
      const stage = this.findStage(requirement, name);
      await this.work.updateStage(stage.id, { ownerIds, ...source });
      await this.work.updateStageStatus(stage.id, {
        status: 'in_progress',
        effectiveAt,
        ...source,
      });
      return stage;
    };

    const microphone = await ensureRequirement(
      firmware,
      {
        versionId: fw28.id,
        title: '运行参数在线切换',
        description: '允许不中断服务切换运行参数，并保留失败回退能力。',
        ownerIds: [fw.id, algo.id],
        plannedStartAt: at(-16),
        plannedEndAt: at(3),
      },
      async (item) => {
        await completeStage(item, '需求确认', [pm.id], at(-16), at(-14));
        await completeStage(item, '方案设计', [algo.id], at(-14), at(-11));
        await startStage(item, '开发', [fw.id, algo.id], at(-10));
        const bug = await this.work.reportBug(item.id, {
          title: '连续切换参数后服务短暂无响应',
          ownerIds: [fw.id],
          discoveredStageId: this.findStage(item, '开发').id,
          targetVersionId: fw28.id,
          plannedStartAt: at(-2),
          plannedEndAt: at(2),
          ...source,
        });
        await this.work.updateBugStatus(bug.id, {
          status: 'in_progress',
          effectiveAt: at(-1, 14),
          ...source,
        });
      },
    );

    const firmwareOta = await ensureRequirement(
      firmware,
      {
        versionId: fw28.id,
        title: '分包更新与断点续传',
        description: '减少更新传输量，并在网络中断后从已校验分片继续。',
        ownerIds: [fw.id, qa.id],
        plannedStartAt: at(-21),
        plannedEndAt: at(5),
      },
      async (item) => {
        await completeStage(item, '需求确认', [pm.id], at(-21), at(-19));
        await completeStage(item, '方案设计', [fw.id], at(-19), at(-15));
        await completeStage(item, '开发', [fw.id], at(-14), at(-7));
        const integration = await startStage(
          item,
          '联调',
          [fw.id, svc.id],
          at(-5),
        );
        await this.work.updateStageStatus(integration.id, {
          status: 'waiting',
          effectiveAt: at(-2),
          statusReason: '等待服务端分批发布接口提供联调环境',
          expectedResumeAt: at(1),
          ...source,
        });
        const bug = await this.work.reportBug(item.id, {
          title: '网络重试后下载进度偶现回退',
          ownerIds: [fw.id],
          discoveredStageId: integration.id,
          targetVersionId: fw28.id,
          plannedStartAt: at(0),
          plannedEndAt: at(4),
          ...source,
        });
        await this.work.updateBugStatus(bug.id, {
          status: 'in_progress',
          effectiveAt: at(0, 10),
          ...source,
        });
      },
    );

    const wakeModel = await ensureRequirement(
      firmware,
      {
        versionId: fw30.id,
        title: '资源模型切换机制',
        description: '支持按演示配置下载、校验并原子切换资源模型。',
        ownerIds: [algo.id, fw.id],
        plannedStartAt: at(8),
        plannedEndAt: at(28),
      },
      async () => undefined,
    );

    await ensureRequirement(
      firmware,
      {
        title: '诊断日志脱敏与分级导出',
        description: '按诊断级别导出日志，并在生成时移除用户敏感字段。',
        ownerIds: [app.id, fw.id],
        plannedStartAt: at(-5),
        plannedEndAt: at(12),
      },
      async (item) => {
        await completeStage(item, '需求确认', [app.id], at(-5), at(-3));
        await startStage(item, '方案设计', [app.id, fw.id], at(-2));
      },
    );

    await ensureRequirement(
      hardware,
      {
        versionId: hwRevB.id,
        title: '外部供电保护验证',
        description: '覆盖反接、浪涌和不同电源组合下的保护边界。',
        ownerIds: [hw.id, qa.id],
        plannedStartAt: at(-28),
        plannedEndAt: at(-8),
      },
      async (item) => {
        await completeStage(item, '设计', [hw.id], at(-28), at(-24));
        await completeStage(item, '首次打样', [hw.id], at(-23), at(-18));
        await completeStage(item, '验证', [hw.id, qa.id], at(-17), at(-11));
        await completeStage(item, '定版', [hw.id], at(-10), at(-8));
      },
    );

    const microphoneNoise = await ensureRequirement(
      hardware,
      {
        versionId: hwRevB.id,
        title: '模拟采集底噪验证',
        description: '验证屏蔽、供电纹波与结构装配对采集底噪的影响。',
        ownerIds: [hw.id, qa.id, algo.id],
        plannedStartAt: at(-12),
        plannedEndAt: at(2),
      },
      async (item) => {
        await completeStage(item, '设计', [hw.id, algo.id], at(-12), at(-10));
        await completeStage(item, '首次打样', [hw.id], at(-9), at(-5));
        const validation = await startStage(
          item,
          '验证',
          [hw.id, qa.id],
          at(-4),
        );
        await this.work.updateStageStatus(validation.id, {
          status: 'blocked',
          effectiveAt: at(-1),
          statusReason: '改版样件尚未到货，当前无法复测底噪',
          expectedResumeAt: at(2),
          ...source,
        });
        const bug = await this.work.reportBug(item.id, {
          title: '采集通道底噪高于目标值',
          ownerIds: [hw.id, algo.id],
          discoveredStageId: validation.id,
          targetVersionId: hwRevB.id,
          plannedStartAt: at(-3),
          plannedEndAt: at(2),
          ...source,
        });
        await this.work.updateBugStatus(bug.id, {
          status: 'blocked',
          effectiveAt: at(-1),
          statusReason: '等待改版样件复测',
          expectedResumeAt: at(2),
          ...source,
        });
      },
    );

    await ensureRequirement(
      hardware,
      {
        versionId: hwRevC.id,
        title: '下一版器件替代评估',
        description: '评估电源、存储与连接器替代料的成本和供应风险。',
        ownerIds: [hw.id, pm.id],
        plannedStartAt: at(5),
        plannedEndAt: at(30),
      },
      async () => undefined,
    );

    const cloudOta = await ensureRequirement(
      cloud,
      {
        versionId: cloudAugust.id,
        title: '更新包分批发布与回滚',
        description: '按设备分组控制发布比例，并在异常指标升高时快速回滚。',
        ownerIds: [svc.id, pm.id],
        plannedStartAt: at(-18),
        plannedEndAt: at(1),
      },
      async (item) => {
        await completeStage(item, '需求设计', [pm.id], at(-18), at(-16));
        await completeStage(
          item,
          '需求评审',
          [svc.id, pm.id],
          at(-16),
          at(-14),
        );
        await completeStage(item, '开发', [svc.id], at(-13), at(-5));
        await startStage(item, '联调', [svc.id, fw.id], at(-4));
      },
    );

    await ensureRequirement(
      cloud,
      {
        versionId: cloudAugust.id,
        title: '终端在线状态聚合',
        description: '统一连接、心跳和业务活跃度口径，提供分钟级状态聚合。',
        ownerIds: [svc.id],
        plannedStartAt: at(-24),
        plannedEndAt: at(-3),
      },
      async (item) => {
        await completeStage(item, '需求设计', [pm.id], at(-24), at(-22));
        await completeStage(item, '需求评审', [svc.id], at(-22), at(-20));
        await completeStage(item, '开发', [svc.id], at(-19), at(-11));
        await completeStage(item, '联调', [svc.id], at(-10), at(-7));
        await completeStage(item, '测试', [qa.id], at(-7), at(-4));
        await completeStage(item, '上线', [svc.id], at(-4), at(-3));
      },
    );

    const modelDistribution = await ensureRequirement(
      cloud,
      {
        versionId: cloudSeptember.id,
        title: '资源模型版本分发',
        description: '管理资源签名、兼容范围和终端分群下发策略。',
        ownerIds: [svc.id, algo.id],
        plannedStartAt: at(-5),
        plannedEndAt: at(15),
      },
      async (item) => {
        await completeStage(item, '需求设计', [algo.id, pm.id], at(-5), at(-3));
        await completeStage(item, '需求评审', [svc.id], at(-3), at(-1));
        const development = await startStage(item, '开发', [svc.id], at(-1));
        await this.work.updateStageStatus(development.id, {
          status: 'waiting',
          effectiveAt: at(0, 11),
          statusReason: '等待资源签名格式最终确认',
          expectedResumeAt: at(2),
          ...source,
        });
      },
    );

    await ensureRequirement(
      cloud,
      {
        versionId: cloudSeptember.id,
        title: '告警订阅与轮值通知',
        description: '支持按项目订阅关键告警，并聚合重复事件后通知轮值成员。',
        ownerIds: [svc.id, app.id],
        plannedStartAt: at(3),
        plannedEndAt: at(22),
      },
      async () => undefined,
    );

    const dependencies = await this.work.listDependencies();
    const ensureDependency = async (
      successorId: string,
      predecessorId: string,
      note: string,
    ) => {
      if (
        dependencies.some(
          (item) =>
            item.successorId === successorId &&
            item.predecessorId === predecessorId &&
            item.active,
        )
      )
        return;
      const created = await this.work.addDependency({
        successorType: 'stage',
        successorId,
        predecessorType: 'stage',
        predecessorId,
        note,
        ...source,
      });
      dependencies.push(created);
    };

    await ensureDependency(
      this.findStage(firmwareOta, '联调').id,
      this.findStage(cloudOta, '联调').id,
      '等待服务端分批发布环境后开展断点续传联调',
    );
    await ensureDependency(
      this.findStage(wakeModel, '开发').id,
      this.findStage(modelDistribution, '开发').id,
      '依赖服务端提供已签名资源与兼容范围查询接口',
    );
    await ensureDependency(
      this.findStage(microphone, '测试').id,
      this.findStage(microphoneNoise, '验证').id,
      '采集验证通过后再固化默认运行参数',
    );

    this.logger.log('演示数据已扩充，可用于项目组合体验');
  }

  private findStage(requirement: Requirement, name: string) {
    const stage = requirement.stages.find((item) => item.name === name);
    if (!stage) throw new Error(`演示数据缺少阶段：${name}`);
    return stage;
  }

  private async scheduleStages(
    requirement: Requirement,
    plannedStartAt: string,
    plannedEndAt: string,
  ) {
    const start = new Date(plannedStartAt).getTime();
    const end = new Date(plannedEndAt).getTime();
    const span = Math.max(86_400_000, end - start);
    for (const [index, stage] of requirement.stages.entries()) {
      const stageStart = new Date(
        start + Math.floor((span * index) / requirement.stages.length),
      ).toISOString();
      const stageEnd = new Date(
        start + Math.floor((span * (index + 1)) / requirement.stages.length),
      ).toISOString();
      await this.work.rescheduleStage(stage.id, {
        plannedStartAt: stageStart,
        plannedEndAt: stageEnd,
        source: 'api',
        reason: '建立演示项目排期',
      });
    }
  }
}
