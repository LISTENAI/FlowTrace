import type {
  ActionItem,
  Bug,
  ChangeEvent,
  Dependency,
  ExecutionStatus,
  Person,
  PersonWorkOverview,
  Project,
  ProjectAgentHandoff,
  ProjectAgentHandoffRevision,
  ProjectRhythm,
  ProjectSnapshot,
  Requirement,
  RequirementSummary,
  Stage,
  StageWorkDomain,
  TemplateStage,
  Version,
} from '@flowtrace/shared';
import { request } from '@/api/client';

export const api = {
  projectRhythms: () => request<ProjectRhythm[]>('/project-rhythms'),
  createProjectRhythm: (input: {
    name: string;
    description?: string;
    stages: Array<{ name: string; workDomain?: StageWorkDomain }>;
  }) =>
    request<ProjectRhythm>('/project-rhythms', {
      method: 'POST',
      body: input,
    }),
  updateProjectRhythm: (
    id: string,
    input: { name?: string; description?: string; stages?: TemplateStage[] },
  ) =>
    request<ProjectRhythm>(`/project-rhythms/${id}`, {
      method: 'PATCH',
      body: input,
    }),
  deleteProjectRhythm: (id: string) =>
    request<void>(`/project-rhythms/${id}`, { method: 'DELETE' }),
  projects: () => request<Project[]>('/projects'),
  project: (id: string) => request<Project>(`/projects/${id}`),
  createProject: (input: {
    key: string;
    name: string;
    description?: string;
    templateStages: Array<{ name: string; workDomain?: StageWorkDomain }>;
  }) => request<Project>('/projects', { method: 'POST', body: input }),
  updateProject: (id: string, input: { name?: string; description?: string }) =>
    request<Project>(`/projects/${id}`, { method: 'PATCH', body: input }),
  projectAgentHandoff: (id: string) =>
    request<ProjectAgentHandoff>(`/projects/${id}/agent-handoff`),
  projectAgentHandoffHistory: (id: string) =>
    request<ProjectAgentHandoffRevision[]>(
      `/projects/${id}/agent-handoff/history`,
    ),
  updateProjectAgentHandoff: (
    id: string,
    input: {
      content: string;
      expectedRevision: number;
      reason?: string;
      source?: 'manual' | 'api' | 'agent';
      agentName?: string;
      agentModel?: string;
    },
  ) =>
    request<ProjectAgentHandoff>(`/projects/${id}/agent-handoff`, {
      method: 'PUT',
      body: input,
    }),
  updateTemplate: (id: string, stages: TemplateStage[]) =>
    request<Project>(`/projects/${id}/template`, {
      method: 'PUT',
      body: { stages },
    }),
  versions: (projectId: string) =>
    request<Version[]>(`/projects/${projectId}/versions`),
  createVersion: (
    projectId: string,
    input: {
      name: string;
      workDomain?: StageWorkDomain;
      status?: string;
      plannedStartAt?: string;
      plannedReleaseAt?: string;
      description?: string;
    },
  ) =>
    request<Version>(`/projects/${projectId}/versions`, {
      method: 'POST',
      body: input,
    }),
  updateVersion: (id: string, input: Record<string, unknown>) =>
    request<Version>(`/versions/${id}`, { method: 'PATCH', body: input }),
  deleteVersion: (
    id: string,
    input: { confirmation: string; reason: string },
  ) =>
    request<void>(`/versions/${id}`, {
      method: 'DELETE',
      body: input,
    }),
  requirements: (filters: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(
      ([key, value]) => value && query.set(key, value),
    );
    return request<RequirementSummary[]>(`/requirements?${query.toString()}`);
  },
  requirement: (id: string) => request<Requirement>(`/requirements/${id}`),
  createRequirement: (input: {
    projectId: string;
    versionId?: string;
    title: string;
    description?: string;
    ownerIds?: string[];
    plannedStartAt?: string;
    plannedEndAt?: string;
    stages?: Array<{
      templateStageId?: string;
      name: string;
      ownerIds?: string[];
      note?: string;
      plannedStartAt?: string;
      plannedEndAt?: string;
    }>;
  }) => request<Requirement>('/requirements', { method: 'POST', body: input }),
  updateRequirement: (
    id: string,
    input: {
      title?: string;
      description?: string;
      ownerIds?: string[];
      lifecycle?: 'not_started' | 'in_progress' | 'done' | 'canceled';
    },
  ) =>
    request<Requirement>(`/requirements/${id}`, {
      method: 'PATCH',
      body: input,
    }),
  deleteRequirement: (
    id: string,
    input: { confirmation: string; reason: string },
  ) =>
    request<void>(`/requirements/${id}`, {
      method: 'DELETE',
      body: input,
    }),
  moveRequirement: (id: string, versionId: string | null, reason?: string) =>
    request<Requirement>(`/requirements/${id}/move-version`, {
      method: 'POST',
      body: { versionId, reason },
    }),
  rescheduleRequirement: (
    id: string,
    input: {
      plannedStartAt?: string | null;
      plannedEndAt?: string | null;
      reason?: string;
    },
  ) =>
    request<Requirement>(`/requirements/${id}/reschedule`, {
      method: 'POST',
      body: input,
    }),
  addStage: (requirementId: string, input: Record<string, unknown>) =>
    request<Stage>(`/requirements/${requirementId}/stages`, {
      method: 'POST',
      body: input,
    }),
  updateStage: (id: string, input: Record<string, unknown>) =>
    request<Stage>(`/stages/${id}`, { method: 'PATCH', body: input }),
  deleteStage: (id: string, input: { confirmation: string; reason: string }) =>
    request<void>(`/stages/${id}`, { method: 'DELETE', body: input }),
  updateStageStatus: (
    id: string,
    input: {
      status: ExecutionStatus;
      effectiveAt?: string;
      actualStartAt?: string;
      actualEndAt?: string;
      statusReason?: string;
      expectedResumeAt?: string;
      note?: string;
      ownerIds?: string[];
    },
  ) => request<Stage>(`/stages/${id}/status`, { method: 'POST', body: input }),
  rescheduleStage: (
    id: string,
    input: {
      plannedStartAt?: string | null;
      plannedEndAt?: string | null;
      reason?: string;
    },
  ) =>
    request<Stage>(`/stages/${id}/reschedule`, { method: 'POST', body: input }),
  addBug: (requirementId: string, input: Record<string, unknown>) =>
    request<Bug>(`/requirements/${requirementId}/bugs`, {
      method: 'POST',
      body: input,
    }),
  updateBug: (id: string, input: Record<string, unknown>) =>
    request<Bug>(`/bugs/${id}`, { method: 'PATCH', body: input }),
  deleteBug: (id: string, input: { confirmation: string; reason: string }) =>
    request<void>(`/bugs/${id}`, { method: 'DELETE', body: input }),
  updateBugStatus: (
    id: string,
    input: {
      status: ExecutionStatus;
      effectiveAt?: string;
      actualStartAt?: string;
      actualEndAt?: string;
      statusReason?: string;
      expectedResumeAt?: string;
      note?: string;
      ownerIds?: string[];
    },
  ) => request<Bug>(`/bugs/${id}/status`, { method: 'POST', body: input }),
  correctStatusHistory: (
    id: string,
    input: {
      status?: ExecutionStatus;
      effectiveAt?: string;
      note?: string;
      statusReason?: string;
      expectedResumeAt?: string | null;
      reason: string;
    },
  ) =>
    request<Stage | Bug>(`/history/status/${id}`, {
      method: 'PATCH',
      body: input,
    }),
  rescheduleBug: (
    id: string,
    input: {
      plannedStartAt?: string | null;
      plannedEndAt?: string | null;
      reason?: string;
    },
  ) => request<Bug>(`/bugs/${id}/reschedule`, { method: 'POST', body: input }),
  people: (includeInactive = false) =>
    request<Person[]>(`/people?includeInactive=${includeInactive}`),
  createPerson: (input: { name: string; email?: string; note?: string }) =>
    request<Person>('/people', { method: 'POST', body: input }),
  updatePerson: (id: string, input: Record<string, unknown>) =>
    request<Person>(`/people/${id}`, { method: 'PATCH', body: input }),
  personWork: (id: string) => request<PersonWorkOverview>(`/people/${id}/work`),
  actionItems: (
    filters: {
      ownerId?: string;
      projectId?: string;
      status?: ExecutionStatus;
    } = {},
  ) => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(
      ([key, value]) => value && query.set(key, value),
    );
    return request<ActionItem[]>(`/action-items?${query.toString()}`);
  },
  actionItem: (id: string) => request<ActionItem>(`/action-items/${id}`),
  createActionItem: (input: {
    title: string;
    description?: string;
    projectId?: string;
    requirementId?: string;
    ownerIds?: string[];
    plannedStartAt?: string;
    plannedEndAt?: string;
  }) => request<ActionItem>('/action-items', { method: 'POST', body: input }),
  updateActionItem: (id: string, input: Record<string, unknown>) =>
    request<ActionItem>(`/action-items/${id}`, {
      method: 'PATCH',
      body: input,
    }),
  updateActionItemStatus: (
    id: string,
    input: {
      status: ExecutionStatus;
      effectiveAt?: string;
      actualStartAt?: string;
      actualEndAt?: string;
      statusReason?: string;
      expectedResumeAt?: string;
      note?: string;
      ownerIds?: string[];
    },
  ) =>
    request<ActionItem>(`/action-items/${id}/status`, {
      method: 'POST',
      body: input,
    }),
  rescheduleActionItem: (
    id: string,
    input: {
      plannedStartAt?: string | null;
      plannedEndAt?: string | null;
      reason?: string;
    },
  ) =>
    request<ActionItem>(`/action-items/${id}/reschedule`, {
      method: 'POST',
      body: input,
    }),
  dependencies: (requirementId?: string) =>
    request<Dependency[]>(
      `/dependencies${requirementId ? `?requirementId=${requirementId}` : ''}`,
    ),
  addDependency: (input: Record<string, unknown>) =>
    request<Dependency>('/dependencies', { method: 'POST', body: input }),
  projectSnapshot: (id: string) =>
    request<ProjectSnapshot>(`/snapshots/projects/${id}`),
  changes: (since: string, projectId?: string) => {
    const query = new URLSearchParams({ since });
    if (projectId) query.set('projectId', projectId);
    return request<ChangeEvent[]>(`/changes?${query.toString()}`);
  },
};
