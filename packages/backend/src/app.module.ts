import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { DomainModule } from '@/domain/domain.module';
import { SeedService } from '@/seed/seed.service';

@Module({
  imports: [DatabaseModule, DomainModule],
  providers: [SeedService],
})
export class AppModule {}
