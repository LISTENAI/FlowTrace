import { MutationInterceptor } from '@/domain/mutation.interceptor';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from '@/database/entities';
import {
  ActionItemsController,
  BugsController,
  DependenciesController,
  HistoryController,
  InsightsController,
  PeopleController,
  ProjectRhythmsController,
  ProjectsController,
  RequirementsController,
  StagesController,
  VersionsController,
} from '@/domain/work.controller';
import { WorkService } from '@/domain/work.service';

@Module({
  imports: [TypeOrmModule.forFeature(entities)],
  controllers: [
    ActionItemsController,
    ProjectsController,
    ProjectRhythmsController,
    PeopleController,
    VersionsController,
    RequirementsController,
    StagesController,
    BugsController,
    DependenciesController,
    InsightsController,
    HistoryController,
  ],
  providers: [WorkService, MutationInterceptor],
  exports: [WorkService],
})
export class DomainModule {}
