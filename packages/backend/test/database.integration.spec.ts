import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { entities } from '@/database/entities';
import { InitialSchema1724428800000 } from '@/database/migrations/1724428800000-initial-schema';
import { ProjectRhythms1724515200000 } from '@/database/migrations/1724515200000-project-rhythms';
import { SoftDeleteWorkItems1724601600000 } from '@/database/migrations/1724601600000-soft-delete-work-items';
import { VersionSortOrder1724688000000 } from '@/database/migrations/1724688000000-version-sort-order';

let dataSource: DataSource | undefined;

afterEach(async () => {
  if (dataSource?.isInitialized) await dataSource.destroy();
});

describe('initial database migration', () => {
  it('creates every domain and history table', async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities,
      migrations: [
        InitialSchema1724428800000,
        ProjectRhythms1724515200000,
        SoftDeleteWorkItems1724601600000,
        VersionSortOrder1724688000000,
      ],
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    const rows = (await dataSource.query(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    )) as Array<{ name: string }>;
    const tables = rows.map((row) => row.name);

    expect(tables).toEqual(
      expect.arrayContaining([
        'projects',
        'project_rhythms',
        'requirements',
        'stages',
        'bugs',
        'status_history',
        'schedule_history',
        'version_history',
        'dependencies',
        'change_events',
      ]),
    );
  });
});
