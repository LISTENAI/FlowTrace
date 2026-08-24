export const executionStatuses = [
  'not_started',
  'in_progress',
  'waiting',
  'blocked',
  'done',
  'canceled',
] as const;

export type ExecutionStatus = (typeof executionStatuses)[number];
export type RequirementLifecycle =
  'not_started' | 'in_progress' | 'done' | 'canceled';
export type HealthStatus = 'normal' | 'waiting' | 'blocked';
export type VersionStatus = 'planning' | 'active' | 'released' | 'canceled';
export type ChangeSource = 'manual' | 'api' | 'agent';
export type DependencyTargetType = 'requirement' | 'stage' | 'bug';
export const searchEntityTypes = [
  'project',
  'version',
  'requirement',
  'stage',
  'bug',
  'person',
] as const;
export type SearchEntityType = (typeof searchEntityTypes)[number];

export interface ChangeContext {
  source?: ChangeSource;
  agentName?: string;
  reason?: string;
}

export interface Person {
  id: string;
  name: string;
  note?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateStage {
  id: string;
  name: string;
  order: number;
  ownerIds: string[];
  dependsOnTemplateStageIds: string[];
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description?: string;
  templateStages: TemplateStage[];
  createdAt: string;
  updatedAt: string;
  metrics?: ProjectMetrics;
}

export interface ProjectRhythm {
  id: string;
  name: string;
  description?: string;
  stages: TemplateStage[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMetrics {
  incompleteRequirements: number;
  waiting: number;
  blocked: number;
  overdue: number;
}

export interface Version {
  id: string;
  projectId: string;
  name: string;
  status: VersionStatus;
  sortOrder: number;
  plannedStartAt?: string;
  plannedReleaseAt?: string;
  actualReleaseAt?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistory {
  id: string;
  fromStatus?: ExecutionStatus;
  toStatus: ExecutionStatus;
  effectiveAt: string;
  note?: string;
  reason?: string;
  expectedResumeAt?: string;
  source: ChangeSource;
  agentName?: string;
  createdAt: string;
}

export interface ScheduleHistory {
  id: string;
  oldStartAt?: string;
  oldEndAt?: string;
  newStartAt?: string;
  newEndAt?: string;
  reason?: string;
  source: ChangeSource;
  agentName?: string;
  changedAt: string;
}

export interface WorkTiming {
  baselineStartAt?: string;
  baselineEndAt?: string;
  plannedStartAt?: string;
  plannedEndAt?: string;
  actualStartAt?: string;
  actualEndAt?: string;
}

export interface Stage extends WorkTiming {
  id: string;
  requirementId: string;
  name: string;
  order: number;
  ownerIds: string[];
  status: ExecutionStatus;
  note?: string;
  statusReason?: string;
  expectedResumeAt?: string;
  statusHistory: StatusHistory[];
  scheduleHistory: ScheduleHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface Bug extends WorkTiming {
  id: string;
  key: string;
  requirementId: string;
  title: string;
  description?: string;
  ownerIds: string[];
  status: ExecutionStatus;
  statusReason?: string;
  expectedResumeAt?: string;
  discoveredStageId?: string;
  discoveredVersionId?: string;
  targetVersionId?: string;
  statusHistory: StatusHistory[];
  scheduleHistory: ScheduleHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface VersionHistory {
  id: string;
  fromVersionId?: string;
  toVersionId?: string;
  reason?: string;
  source: ChangeSource;
  agentName?: string;
  effectiveAt: string;
  changedAt: string;
}

export interface Requirement extends WorkTiming {
  id: string;
  key: string;
  projectId: string;
  versionId?: string;
  title: string;
  description?: string;
  ownerIds: string[];
  lifecycle: RequirementLifecycle;
  health: HealthStatus;
  stages: Stage[];
  bugs: Bug[];
  versionHistory: VersionHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface Dependency {
  id: string;
  successorType: DependencyTargetType;
  successorId: string;
  predecessorType: DependencyTargetType;
  predecessorId: string;
  note?: string;
  active: boolean;
  source: ChangeSource;
  agentName?: string;
  createdAt: string;
  resolvedAt?: string;
  predecessor?: DependencyTargetSummary;
  successor?: DependencyTargetSummary;
  satisfied?: boolean;
}

export interface DependencyTargetSummary {
  id: string;
  key?: string;
  name: string;
  projectId: string;
  projectName: string;
  requirementId: string;
  requirementKey: string;
  status: ExecutionStatus | RequirementLifecycle;
}

export interface ChangeEvent {
  id: string;
  entityType: string;
  entityId: string;
  projectId?: string;
  requirementId?: string;
  type: string;
  summary: string;
  details?: Record<string, unknown>;
  reason?: string;
  source: ChangeSource;
  agentName?: string;
  occurredAt: string;
  project?: Pick<Project, 'id' | 'key' | 'name'>;
  version?: Pick<Version, 'id' | 'name'>;
  requirement?: Pick<Requirement, 'id' | 'key' | 'title'>;
}

export interface SearchResult {
  type: SearchEntityType;
  id: string;
  key?: string;
  name: string;
  projectId?: string;
  projectName?: string;
  versionId?: string;
  versionName?: string;
  requirementId?: string;
  requirementKey?: string;
  status?: ExecutionStatus | RequirementLifecycle | VersionStatus;
  active?: boolean;
}

export interface RequirementSummary extends Omit<
  Requirement,
  'stages' | 'bugs' | 'versionHistory'
> {
  stageCount: number;
  bugCount: number;
  completedBugCount: number;
  currentStage?: string;
  overdue: boolean;
}

export interface SnapshotMetrics {
  total: number;
  completed: number;
  inProgress: number;
  waiting: number;
  blocked: number;
  overdue: number;
  openBugs: number;
}

export interface ProjectSnapshot {
  project: Project;
  versions: Version[];
  metrics: SnapshotMetrics;
  requirements: RequirementSummary[];
  waitingItems: SnapshotWorkItem[];
  blockedItems: SnapshotWorkItem[];
  delayedItems: RequirementSummary[];
  openBugs: SnapshotWorkItem[];
  externalDependencies: Dependency[];
  recentChanges: ChangeEvent[];
  generatedAt: string;
}

export interface VersionSnapshot extends ProjectSnapshot {
  version: Version;
}

export interface SnapshotWorkItem extends WorkTiming {
  type: 'stage' | 'bug';
  id: string;
  key?: string;
  name: string;
  status: ExecutionStatus;
  reason?: string;
  expectedResumeAt?: string;
  ownerIds: string[];
  requirementId: string;
  requirementKey: string;
  requirementTitle: string;
}

export interface RequirementDetail {
  requirement: Requirement;
  project: Project;
  version?: Version;
  people: Person[];
  dependencies: Dependency[];
}

export interface StatusDuration {
  inProgressMs: number;
  waitingMs: number;
  blockedMs: number;
  totalSpanMs: number;
}
