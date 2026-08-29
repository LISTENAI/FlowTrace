import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import type { DataSource } from 'typeorm';
import { createTestDataSource } from './support/database';

let dataSource: DataSource | undefined;

afterEach(async () => {
  if (dataSource?.isInitialized) await dataSource.destroy();
});

describe('initial database migration', () => {
  it('creates every domain and history table', async () => {
    dataSource = await createTestDataSource();

    const rows = (await dataSource.query(
      `SELECT table_name AS "name"
       FROM information_schema.tables
       WHERE table_schema = 'public'`,
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

    const versionHistoryColumns = (await dataSource.query(
      `SELECT column_name AS "name" FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'version_history'`,
    )) as Array<{ name: string }>;
    const changeColumns = (await dataSource.query(
      `SELECT column_name AS "name" FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'change_events'`,
    )) as Array<{ name: string }>;
    const stageColumns = (await dataSource.query(
      `SELECT column_name AS "name" FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'stages'`,
    )) as Array<{ name: string }>;
    expect(versionHistoryColumns.map((column) => column.name)).toContain(
      'effectiveAt',
    );
    expect(changeColumns.map((column) => column.name)).toContain('reason');
    expect(stageColumns.map((column) => column.name)).toContain('workDomain');
  });
});
