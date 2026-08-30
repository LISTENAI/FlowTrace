import { DataType, newDb } from 'pg-mem';
import type { DataSource } from 'typeorm';
import { entities } from '@/database/entities';
import { migrations } from '@/database/migrations';

export async function createTestDataSource(): Promise<DataSource> {
  const database = newDb({ autoCreateForeignKeyIndices: true });
  database.public.registerFunction({
    name: 'current_database',
    returns: DataType.text,
    implementation: () => 'flowtrace_test',
  });
  database.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 16.0',
  });
  database.public.registerFunction({
    name: 'hashtext',
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (value: string) => value.length,
  });
  database.public.registerFunction({
    name: 'pg_advisory_xact_lock',
    args: [DataType.integer],
    returns: DataType.integer,
    implementation: () => 1,
  });

  const dataSource = database.adapters.createTypeormDataSource({
    type: 'postgres',
    entities,
    migrations,
    migrationsRun: true,
    synchronize: false,
  });
  await dataSource.initialize();
  return dataSource;
}
