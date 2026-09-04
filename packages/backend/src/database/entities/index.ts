export { ActionItemEntity } from '@/database/entities/action-item.entity';
export { BugEntity } from '@/database/entities/bug.entity';
export { AuthPersonBindingEntity } from '@/database/entities/auth-person-binding.entity';
export { ChangeEventEntity } from '@/database/entities/change-event.entity';
export { DependencyEntity } from '@/database/entities/dependency.entity';
export { PersonEntity } from '@/database/entities/person.entity';
export { ProjectEntity } from '@/database/entities/project.entity';
export { ProjectAgentHandoffRevisionEntity } from '@/database/entities/project-agent-handoff-revision.entity';
export { ProjectRhythmEntity } from '@/database/entities/project-rhythm.entity';
export { RequirementEntity } from '@/database/entities/requirement.entity';
export { ScheduleHistoryEntity } from '@/database/entities/schedule-history.entity';
export { StageEntity } from '@/database/entities/stage.entity';
export { StatusHistoryEntity } from '@/database/entities/status-history.entity';
export { VersionEntity } from '@/database/entities/version.entity';
export { VersionHistoryEntity } from '@/database/entities/version-history.entity';

import { ActionItemEntity } from '@/database/entities/action-item.entity';
import { BugEntity } from '@/database/entities/bug.entity';
import { AuthPersonBindingEntity } from '@/database/entities/auth-person-binding.entity';
import { ChangeEventEntity } from '@/database/entities/change-event.entity';
import { DependencyEntity } from '@/database/entities/dependency.entity';
import { PersonEntity } from '@/database/entities/person.entity';
import { ProjectEntity } from '@/database/entities/project.entity';
import { ProjectAgentHandoffRevisionEntity } from '@/database/entities/project-agent-handoff-revision.entity';
import { ProjectRhythmEntity } from '@/database/entities/project-rhythm.entity';
import { RequirementEntity } from '@/database/entities/requirement.entity';
import { ScheduleHistoryEntity } from '@/database/entities/schedule-history.entity';
import { StageEntity } from '@/database/entities/stage.entity';
import { StatusHistoryEntity } from '@/database/entities/status-history.entity';
import { VersionEntity } from '@/database/entities/version.entity';
import { VersionHistoryEntity } from '@/database/entities/version-history.entity';

export const entities = [
  ActionItemEntity,
  AuthPersonBindingEntity,
  ProjectEntity,
  ProjectAgentHandoffRevisionEntity,
  ProjectRhythmEntity,
  PersonEntity,
  VersionEntity,
  RequirementEntity,
  StageEntity,
  BugEntity,
  StatusHistoryEntity,
  ScheduleHistoryEntity,
  VersionHistoryEntity,
  DependencyEntity,
  ChangeEventEntity,
];
