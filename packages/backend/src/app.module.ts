import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { DatabaseModule } from '@/database/database.module';
import { DomainModule } from '@/domain/domain.module';
import { McpController } from '@/mcp/mcp.controller';
import { SeedService } from '@/seed/seed.service';

@Module({
  imports: [DatabaseModule, AuthModule, DomainModule],
  controllers: [McpController],
  providers: [SeedService],
})
export class AppModule {}
