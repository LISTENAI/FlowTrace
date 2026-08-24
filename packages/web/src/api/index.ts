import type {
  Bug,
  ChangeEvent,
  Dependency,
  ExecutionStatus,
  Person,
  Project,
  ProjectRhythm,
  ProjectSnapshot,
  Requirement,
  RequirementSummary,
  Stage,
  TemplateStage,
  Version,
} from '@flowtrace/shared';
import { request } from '@/api/client';

export const api = {
  projectRhythms: () => request<ProjectRhythm[]>('/project-rhythms'),
  createProjectRhythm: (input: {
    name: string;
    description?: string;
    stages: Array<{ name: string }>;
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
    templateStages: Array<{ name: string }>;
  }) => request<Project>('/projects', { method: 'POST', body: input }),
  updateProject: (id: string, input: { name?: string; description?: string }) =>
    request<Project>(`/projects/${id}`, { method: 'PATCH', body: input }),
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
  }) => request<Requirement>('/requirements', { method: 'POST', body: input }),
  updateRequirement: (id: string, input: Record<string, unknown>) =>
    request<Requirement>(`/requirements/${id}`, {
      method: 'PATCH',
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
  createPerson: (input: { name: string; note?: string }) =>
    request<Person>('/people', { method: 'POST', body: input }),
  updatePerson: (id: string, input: Record<string, unknown>) =>
    request<Person>(`/people/${id}`, { method: 'PATCH', body: input }),
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
