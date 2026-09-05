import { MutationHistorySubscriber } from '@/database/mutation-history.subscriber';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseSsl, typeOrmConnection } from '@/database/config';
import { entities } from '@/database/entities';
import { migrations } from '@/database/migrations';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      ...typeOrmConnection(),
      ssl: databaseSsl(),
      entities,
      subscribers: [MutationHistorySubscriber],
      migrations,
      migrationsRun: true,
      synchronize: false,
    }),
  ],
})
export class DatabaseModule {}
