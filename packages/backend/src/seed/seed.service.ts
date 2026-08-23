import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import type { TemplateStage } from '@flowtrace/shared';
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
    order,
    ownerIds: [],
    dependsOnTemplateStageIds: order ? [ids[order - 1] as string] : [],
  }));
};

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(@Inject(WorkService) private readonly work: WorkService) {}

  async onApplicationBootstrap() {
    if (process.env.FLOWTRACE_SEED_DEMO === 'false') return;
    if ((await this.work.listProjects()).length) return;
    this.logger.log('正在初始化演示项目');
    await this.seed();
  }

  private async seed() {
    const [fw, qa, hw, svc] = await Promise.all([
      this.work.createPerson({ name: '示例成员 A', note: '固件研发' }),
      this.work.createPerson({ name: '示例成员 B', note: '测试' }),
      this.work.createPerson({ name: '示例成员 C', note: '硬件研发' }),
      this.work.createPerson({ name: '示例成员 D', note: '云端研发' }),
    ]);
    const source = { source: 'api' as const, reason: '初始化演示数据' };
    const [firmware, hardware, cloud] = await Promise.all([
      this.work.createProject({
        key: 'FW',
        name: '示例设备固件',
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
        name: '示例硬件平台',
        description: '硬件设计、打样与定版',
        templateStages: template(['设计', '首次打样', '验证', '定版']),
        ...source,
      }),
      this.work.createProject({
        key: 'CLOUD',
        name: '示例云端服务',
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
}
