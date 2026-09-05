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
       WHERE table_schema = $1`,
      [(dataSource.options as { schema?: string }).schema ?? 'public'],
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
        'auth_user',
        'auth_session',
        'auth_account',
        'auth_api_key',
        'auth_person_bindings',
      ]),
    );

    const versionHistoryColumns = (await dataSource.query(
      `SELECT column_name AS "name" FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'version_history'`,
      [(dataSource.options as { schema?: string }).schema ?? 'public'],
    )) as Array<{ name: string }>;
    const changeColumns = (await dataSource.query(
      `SELECT column_name AS "name" FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'change_events'`,
      [(dataSource.options as { schema?: string }).schema ?? 'public'],
    )) as Array<{ name: string }>;
    const stageColumns = (await dataSource.query(
      `SELECT column_name AS "name" FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'stages'`,
      [(dataSource.options as { schema?: string }).schema ?? 'public'],
    )) as Array<{ name: string }>;
    expect(versionHistoryColumns.map((column) => column.name)).toContain(
      'effectiveAt',
    );
    expect(changeColumns.map((column) => column.name)).toContain('reason');
    expect(stageColumns.map((column) => column.name)).toContain('workDomain');
    const personColumns = (await dataSource.query(
      `SELECT column_name AS "name" FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'people'`,
      [(dataSource.options as { schema?: string }).schema ?? 'public'],
    )) as Array<{ name: string }>;
    expect(personColumns.map((column) => column.name)).toContain('email');

    const authUserColumns = (await dataSource.query(
      `SELECT column_name AS "name" FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'auth_user'`,
      [(dataSource.options as { schema?: string }).schema ?? 'public'],
    )) as Array<{ name: string }>;
    expect(authUserColumns.map((column) => column.name)).toContain(
      'localOwner',
    );

    const bindingColumns = (await dataSource.query(
      `SELECT column_name AS "name" FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'auth_person_bindings'`,
      [(dataSource.options as { schema?: string }).schema ?? 'public'],
    )) as Array<{ name: string }>;
    expect(bindingColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'providerId',
        'providerSubject',
        'nameAuthority',
        'emailAuthority',
      ]),
    );
  });
});
