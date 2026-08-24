import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { entities } from '@/database/entities';
import { InitialSchema1724428800000 } from '@/database/migrations/1724428800000-initial-schema';
import { ProjectRhythms1724515200000 } from '@/database/migrations/1724515200000-project-rhythms';
import { SoftDeleteWorkItems1724601600000 } from '@/database/migrations/1724601600000-soft-delete-work-items';
import { VersionSortOrder1724688000000 } from '@/database/migrations/1724688000000-version-sort-order';
import { DomainModule } from '@/domain/domain.module';
import { WorkService } from '@/domain/work.service';
import { SeedService } from '@/seed/seed.service';

describe.sequential('SeedService experience data', () => {
  const originalSeedMode = process.env.FLOWTRACE_SEED_DEMO;
  let dataSource: DataSource;
  let seed: SeedService;
  let work: WorkService;

  beforeAll(async () => {
    delete process.env.FLOWTRACE_SEED_DEMO;
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
          ],
          migrationsRun: true,
          synchronize: false,
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
  });
});
