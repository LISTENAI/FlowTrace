import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from '@/database/entities';
import {
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
  providers: [WorkService],
  exports: [WorkService],
})
export class DomainModule {}
