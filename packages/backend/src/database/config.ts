import type { PoolConfig } from 'pg';

export function databaseSsl() {
  const mode = process.env.FLOWTRACE_DATABASE_SSL;
  if (mode === 'require') return { rejectUnauthorized: false };
  if (mode === 'verify-full') return { rejectUnauthorized: true };
  return false as const;
}

export function typeOrmConnection() {
  return process.env.FLOWTRACE_DATABASE_URL
    ? { url: process.env.FLOWTRACE_DATABASE_URL }
    : {
        host: process.env.FLOWTRACE_DATABASE_HOST ?? '127.0.0.1',
        port: Number(process.env.FLOWTRACE_DATABASE_PORT ?? 5432),
        username: process.env.FLOWTRACE_DATABASE_USER ?? 'flowtrace',
        password: process.env.FLOWTRACE_DATABASE_PASSWORD ?? 'flowtrace',
        database: process.env.FLOWTRACE_DATABASE_NAME ?? 'flowtrace',
      };
}

export function postgresPoolConfig(): PoolConfig {
  const ssl = databaseSsl();
  if (process.env.FLOWTRACE_DATABASE_URL) {
    return { connectionString: process.env.FLOWTRACE_DATABASE_URL, ssl };
  }
  return {
    host: process.env.FLOWTRACE_DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.FLOWTRACE_DATABASE_PORT ?? 5432),
    user: process.env.FLOWTRACE_DATABASE_USER ?? 'flowtrace',
    password: process.env.FLOWTRACE_DATABASE_PASSWORD ?? 'flowtrace',
    database: process.env.FLOWTRACE_DATABASE_NAME ?? 'flowtrace',
    ssl,
  };
}
