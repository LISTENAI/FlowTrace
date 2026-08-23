import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from '@/database/entities';
import { InitialSchema1724428800000 } from '@/database/migrations/1724428800000-initial-schema';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.FLOWTRACE_DATABASE_PATH ?? 'data/flowtrace.db',
      entities,
      migrations: [InitialSchema1724428800000],
      migrationsRun: true,
      synchronize: false,
      enableWAL: true,
    }),
  ],
})
export class DatabaseModule {}
