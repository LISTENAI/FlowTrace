import { DataType, newDb } from 'pg-mem';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { entities } from '@/database/entities';
import { migrations } from '@/database/migrations';

export async function createTestDataSource(): Promise<DataSource> {
  if (process.env.FLOWTRACE_TEST_DATABASE_URL)
    return createPostgresTestDataSource(
      process.env.FLOWTRACE_TEST_DATABASE_URL,
    );
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
  const createQueryRunner = dataSource.createQueryRunner.bind(dataSource);
  dataSource.createQueryRunner = (
    ...args: Parameters<DataSource['createQueryRunner']>
  ) => {
    const queryRunner = createQueryRunner(...args);
    const startTransaction = queryRunner.startTransaction.bind(queryRunner);
    const rollbackTransaction =
      queryRunner.rollbackTransaction.bind(queryRunner);
    let backup: ReturnType<typeof database.backup> | undefined;
    queryRunner.startTransaction = async (
      ...transactionArgs: Parameters<typeof startTransaction>
    ) => {
      backup = database.backup();
      await startTransaction(...transactionArgs);
    };
    queryRunner.rollbackTransaction = async () => {
      await rollbackTransaction();
      backup?.restore();
      backup = undefined;
    };
    return queryRunner;
  };
  return dataSource;
}

async function createPostgresTestDataSource(url: string): Promise<DataSource> {
  const target = new URL(url);
  if (!target.pathname.startsWith('/flowtrace_test'))
    throw new Error('测试数据库名称必须以 flowtrace_test 开头');
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const pool = new Pool({ connectionString: url });
  await pool.query(`CREATE SCHEMA "${schema}"`);
  const source = new DataSource({
    type: 'postgres',
    url,
    schema,
    extra: { options: `-c search_path=${schema},public` },
    entities,
    migrations,
    migrationsRun: true,
    synchronize: false,
  });
  try {
    await source.initialize();
  } catch (error) {
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await pool.end();
    throw error;
  }
  const destroy = source.destroy.bind(source);
  source.destroy = async () => {
    try {
      await destroy();
    } finally {
      await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
      await pool.end();
    }
  };
  return source;
}
