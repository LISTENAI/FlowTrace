import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { DomainModule } from '@/domain/domain.module';
import { WorkService } from '@/domain/work.service';
import { SeedService } from '@/seed/seed.service';
import { createTestDataSource } from './support/database';

describe.sequential('SeedService experience data', () => {
  const originalSeedMode = process.env.FLOWTRACE_SEED_DEMO;
  let dataSource: DataSource;
  let seed: SeedService;
  let work: WorkService;

  beforeAll(async () => {
    delete process.env.FLOWTRACE_SEED_DEMO;
    dataSource = await createTestDataSource();
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useFactory: () => dataSource.options as TypeOrmModuleOptions,
          dataSourceFactory: async () => dataSource,
        }),
        DomainModule,
      ],
      providers: [SeedService],
    }).compile();
    dataSource = module.get(DataSource);
    seed = module.get(SeedService);
    work = module.get(WorkService);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (originalSeedMode === undefined) delete process.env.FLOWTRACE_SEED_DEMO;
    else process.env.FLOWTRACE_SEED_DEMO = originalSeedMode;
  });

  it('only creates baseline rhythms unless demo data is explicitly enabled', async () => {
    await seed.onApplicationBootstrap();

    expect(await work.listProjectRhythms()).toHaveLength(3);
    expect(await work.listProjects()).toHaveLength(0);
    expect(await work.listPeople(true)).toHaveLength(0);
  });

  it('creates a varied portfolio and remains idempotent', async () => {
    process.env.FLOWTRACE_SEED_DEMO = 'true';
    await seed.onApplicationBootstrap();
    await seed.onApplicationBootstrap();

    const projects = await work.listProjects();
    const firmware = projects.find((item) => item.key === 'FW')!;
    const hardware = projects.find((item) => item.key === 'HW')!;
    const cloud = projects.find((item) => item.key === 'CLOUD')!;

    expect(projects).toHaveLength(3);
    expect(await work.listProjectRhythms()).toHaveLength(3);
    expect(await work.listPeople(true)).toHaveLength(7);
    expect(await work.listVersions(firmware.id)).toHaveLength(3);
    expect(await work.listVersions(hardware.id)).toHaveLength(2);
    expect(await work.listVersions(cloud.id)).toHaveLength(2);
    expect(
      await work.listRequirements({ projectId: firmware.id }),
    ).toHaveLength(6);
    expect(
      await work.listRequirements({ projectId: hardware.id }),
    ).toHaveLength(4);
    expect(await work.listRequirements({ projectId: cloud.id })).toHaveLength(
      5,
    );

    const snapshots = await Promise.all(
      projects.map((project) => work.getProjectSnapshot(project.id)),
    );
    expect(
      snapshots.flatMap((item) => item.blockedItems).length,
    ).toBeGreaterThan(1);
    expect(
      snapshots.flatMap((item) => item.waitingItems).length,
    ).toBeGreaterThan(1);
    expect(
      snapshots.flatMap((item) => item.externalDependencies).length,
    ).toBeGreaterThan(2);
  }, 15_000);
});
