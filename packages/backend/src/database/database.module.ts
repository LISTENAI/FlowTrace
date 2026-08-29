import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from '@/database/entities';
import { migrations } from '@/database/migrations';

const connection = process.env.FLOWTRACE_DATABASE_URL
  ? { url: process.env.FLOWTRACE_DATABASE_URL }
  : {
      host: process.env.FLOWTRACE_DATABASE_HOST ?? '127.0.0.1',
      port: Number(process.env.FLOWTRACE_DATABASE_PORT ?? 5432),
      username: process.env.FLOWTRACE_DATABASE_USER ?? 'flowtrace',
      password: process.env.FLOWTRACE_DATABASE_PASSWORD ?? 'flowtrace',
      database: process.env.FLOWTRACE_DATABASE_NAME ?? 'flowtrace',
    };
const sslMode = process.env.FLOWTRACE_DATABASE_SSL;

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      ...connection,
      ssl:
        sslMode === 'require'
          ? { rejectUnauthorized: false }
          : sslMode === 'verify-full'
            ? { rejectUnauthorized: true }
            : false,
      entities,
      migrations,
      migrationsRun: true,
      synchronize: false,
    }),
  ],
})
export class DatabaseModule {}
