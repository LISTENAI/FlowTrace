import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from '@/database/entities';
import { InitialSchema1724428800000 } from '@/database/migrations/1724428800000-initial-schema';
import { ProjectRhythms1724515200000 } from '@/database/migrations/1724515200000-project-rhythms';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.FLOWTRACE_DATABASE_PATH ?? 'data/flowtrace.db',
      entities,
      migrations: [InitialSchema1724428800000, ProjectRhythms1724515200000],
      migrationsRun: true,
      synchronize: false,
      enableWAL: true,
    }),
  ],
})
export class DatabaseModule {}
