import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  Bug,
  ChangeContext,
  ChangeEvent,
  Dependency,
  DependencyTargetSummary,
  DependencyTargetType,
  ExecutionStatus,
  HealthStatus,
  Person,
  Project,
  ProjectRhythm,
  ProjectSnapshot,
  Requirement,
  RequirementLifecycle,
  RequirementSummary,
  ScheduleHistory,
  Stage,
  StatusDuration,
  StatusHistory,
  TemplateStage,
  Version,
  VersionHistory,
  VersionSnapshot,
} from '@flowtrace/shared';
import { randomUUID } from 'node:crypto';
import {
  DataSource,
  EntityManager,
  type FindOptionsWhere,
  In,
  IsNull,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import {
  BugEntity,
  ChangeEventEntity,
  DependencyEntity,
  PersonEntity,
  ProjectEntity,
  ProjectRhythmEntity,
  RequirementEntity,
  ScheduleHistoryEntity,
  StageEntity,
  StatusHistoryEntity,
  VersionEntity,
  VersionHistoryEntity,
  entities,
} from '@/database/entities';
import type {
  BatchDto,
  CorrectStatusHistoryDto,
  CreateBugDto,
  CreateDependencyDto,
  CreatePersonDto,
  CreateProjectDto,
  CreateProjectRhythmDto,
  CreateRequirementDto,
  CreateStageDto,
  CreateVersionDto,
  MoveVersionDto,
  RescheduleDto,
  UpdateBugDto,
  UpdatePersonDto,
  UpdateProjectDto,
  UpdateProjectRhythmDto,
  UpdateRequirementDto,
  UpdateStageDto,
  UpdateStatusDto,
  UpdateTemplateDto,
  UpdateVersionDto,
} from '@/domain/dto';

type TrackableEntity = StageEntity | BugEntity;
type SchedulableEntity = RequirementEntity | StageEntity | BugEntity;
type EntityKind = 'requirement' | 'stage' | 'bug';

const iso = (date: Date | null | undefined) => date?.toISOString();
const date = (value: string | null | undefined) =>
  value === null || value === undefined ? null : new Date(value);
const context = (
  value: ChangeContext = {},
): Required<Pick<ChangeContext, 'source'>> & ChangeContext => ({
  source: value.source ?? 'manual',
  agentName: value.agentName,
  reason: value.reason,
});

@Injectable()
export class WorkService {
  constructor(
    @Inject(DataSource)
    private readonly dataSource: DataSource,
    @InjectRepository(ProjectEntity)
    private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(ProjectRhythmEntity)
    private readonly projectRhythms: Repository<ProjectRhythmEntity>,
    @InjectRepository(PersonEntity)
    private readonly people: Repository<PersonEntity>,
    @InjectRepository(VersionEntity)
    private readonly versions: Repository<VersionEntity>,
    @InjectRepository(RequirementEntity)
    private readonly requirements: Repository<RequirementEntity>,
    @InjectRepository(StageEntity)
    private readonly stages: Repository<StageEntity>,
    @InjectRepository(BugEntity)
    private readonly bugs: Repository<BugEntity>,
    @InjectRepository(StatusHistoryEntity)
    private readonly statuses: Repository<StatusHistoryEntity>,
    @InjectRepository(ScheduleHistoryEntity)
    private readonly schedules: Repository<ScheduleHistoryEntity>,
    @InjectRepository(VersionHistoryEntity)
    private readonly versionHistory: Repository<VersionHistoryEntity>,
    @InjectRepository(DependencyEntity)
    private readonly dependencyRepository: Repository<DependencyEntity>,
    @InjectRepository(ChangeEventEntity)
    private readonly changes: Repository<ChangeEventEntity>,
  ) {}

  async listProjectRhythms(): Promise<ProjectRhythm[]> {
    const rows = await this.projectRhythms.find({
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return rows.map((item) => this.toProjectRhythm(item));
  }

  async createProjectRhythm(
    input: CreateProjectRhythmDto,
  ): Promise<ProjectRhythm> {
    if (await this.projectRhythms.existsBy({ name: input.name })) {
      throw new BadRequestException(`项目节奏「${input.name}」已存在`);
    }
    const last = (
      await this.projectRhythms.find({
        order: { sortOrder: 'DESC' },
        take: 1,
      })
    )[0];
    const rhythm = this.projectRhythms.create({
      id: randomUUID(),
      name: input.name,
      description: input.description || null,
      stages: this.normalizeTemplate(input.stages),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    });
    return this.toProjectRhythm(await this.projectRhythms.save(rhythm));
  }

  async updateProjectRhythm(
    id: string,
    input: UpdateProjectRhythmDto,
  ): Promise<ProjectRhythm> {
    const rhythm = await this.projectRhythms.findOneBy({ id });
    if (!rhythm) throw new NotFoundException('未找到项目节奏');
    if (input.name !== undefined && input.name !== rhythm.name) {
      if (await this.projectRhythms.existsBy({ name: input.name })) {
        throw new BadRequestException(`项目节奏「${input.name}」已存在`);
      }
      rhythm.name = input.name;
    }
    if (input.description !== undefined)
      rhythm.description = input.description || null;
    if (input.stages !== undefined)
      rhythm.stages = this.normalizeTemplate(input.stages);
    return this.toProjectRhythm(await this.projectRhythms.save(rhythm));
  }

  async deleteProjectRhythm(id: string): Promise<void> {
    const rhythm = await this.projectRhythms.findOneBy({ id });
    if (!rhythm) throw new NotFoundException('未找到项目节奏');
    await this.projectRhythms.remove(rhythm);
  }

  async listProjects(): Promise<Project[]> {
    const projects = await this.projects.find({ order: { updatedAt: 'DESC' } });
    return Promise.all(
      projects.map((project) => this.toProject(project, true)),
    );
  }

  async getProject(id: string): Promise<Project> {
    return this.toProject(await this.findProject(id), true);
  }

  async createProject(input: CreateProjectDto): Promise<Project> {
    const key = input.key.toUpperCase();
    if (await this.projects.existsBy({ key })) {
      throw new BadRequestException(`项目标识 ${key} 已存在`);
    }
    const project = this.projects.create({
      id: randomUUID(),
      key,
      name: input.name,
      description: input.description ?? null,
      templateStages: this.normalizeTemplate(input.templateStages ?? []),
      requirementSequence: 0,
      bugSequence: 0,
    });
    await this.projects.save(project);
    await this.recordChange(this.dataSource.manager, {
      entityType: 'project',
      entityId: project.id,
      projectId: project.id,
      type: 'project_created',
      summary: `创建项目「${project.name}」`,
      ...context(input),
    });
    return this.toProject(project, true);
  }

  async updateProject(id: string, input: UpdateProjectDto): Promise<Project> {
    const project = await this.findProject(id);
    if (input.name !== undefined) project.name = input.name;
    if (input.description !== undefined)
      project.description = input.description || null;
    await this.projects.save(project);
    return this.toProject(project, true);
  }

  async updateTemplate(id: string, input: UpdateTemplateDto): Promise<Project> {
    const project = await this.findProject(id);
    project.templateStages = this.normalizeTemplate(input.stages);
    await this.projects.save(project);
    await this.recordChange(this.dataSource.manager, {
      entityType: 'project',
      entityId: project.id,
      projectId: project.id,
      type: 'template_updated',
      summary: `更新「${project.name}」的需求阶段模板`,
      details: { stageCount: project.templateStages.length },
      ...context(input),
    });
    return this.toProject(project, true);
  }

  async listPeople(includeInactive = false): Promise<Person[]> {
    const rows = await this.people.find({
      where: includeInactive ? {} : { active: true },
      order: { active: 'DESC', name: 'ASC' },
    });
    return rows.map((item) => this.toPerson(item));
  }

  async createPerson(input: CreatePersonDto): Promise<Person> {
    const person = this.people.create({
      id: randomUUID(),
      name: input.name,
      note: input.note ?? null,
      active: true,
    });
    return this.toPerson(await this.people.save(person));
  }

  async updatePerson(id: string, input: UpdatePersonDto): Promise<Person> {
    const person = await this.people.findOneBy({ id });
    if (!person) throw new NotFoundException('未找到人员');
    if (input.name !== undefined) person.name = input.name;
    if (input.note !== undefined) person.note = input.note || null;
    if (input.active !== undefined) person.active = input.active;
    return this.toPerson(await this.people.save(person));
  }

  async listVersions(projectId: string): Promise<Version[]> {
    const rows = await this.versions.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((item) => this.toVersion(item));
  }

  async createVersion(
    projectId: string,
    input: CreateVersionDto,
  ): Promise<Version> {
    const project = await this.findProject(projectId);
    const version = this.versions.create({
      id: randomUUID(),
      projectId: project.id,
      name: input.name,
      status: input.status ?? 'planning',
      plannedStartAt: date(input.plannedStartAt),
      plannedReleaseAt: date(input.plannedReleaseAt),
      actualReleaseAt: null,
      description: input.description ?? null,
    });
    await this.versions.save(version);
    await this.recordChange(this.dataSource.manager, {
      entityType: 'version',
      entityId: version.id,
      projectId: project.id,
      type: 'version_created',
      summary: `创建版本「${version.name}」`,
      ...context(input),
    });
    return this.toVersion(version);
  }

  async updateVersion(id: string, input: UpdateVersionDto): Promise<Version> {
    const version = await this.versions.findOneBy({ id });
    if (!version) throw new NotFoundException('未找到版本');
    if (input.name !== undefined) version.name = input.name;
    if (input.status !== undefined) version.status = input.status;
    if (input.plannedStartAt !== undefined)
      version.plannedStartAt = date(input.plannedStartAt);
    if (input.plannedReleaseAt !== undefined)
      version.plannedReleaseAt = date(input.plannedReleaseAt);
    if (input.actualReleaseAt !== undefined)
      version.actualReleaseAt = date(input.actualReleaseAt);
    if (input.description !== undefined)
      version.description = input.description || null;
    await this.versions.save(version);
    await this.recordChange(this.dataSource.manager, {
      entityType: 'version',
      entityId: version.id,
      projectId: version.projectId,
      type: 'version_updated',
      summary: `更新版本「${version.name}」`,
      ...context(input),
    });
    return this.toVersion(version);
  }

  async listRequirements(filters: {
    projectId?: string;
    versionId?: string;
    ownerId?: string;
    lifecycle?: RequirementLifecycle;
    health?: HealthStatus;
    overdue?: boolean;
  }): Promise<RequirementSummary[]> {
    const where: FindOptionsWhere<RequirementEntity> = {};
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.versionId !== undefined)
      where.versionId = filters.versionId || IsNull();
    if (filters.lifecycle) where.lifecycle = filters.lifecycle;
    const rows = await this.requirements.find({
      where,
      order: { updatedAt: 'DESC' },
    });
    const summaries = await Promise.all(
      rows.map((row) => this.getRequirementSummary(row)),
    );
    return summaries.filter((item) => {
      if (filters.ownerId && !item.ownerIds.includes(filters.ownerId))
        return false;
      if (filters.health && item.health !== filters.health) return false;
      if (filters.overdue !== undefined && item.overdue !== filters.overdue)
        return false;
      return true;
    });
  }

  async getRequirement(idOrKey: string): Promise<Requirement> {
    const requirement = await this.findRequirement(idOrKey);
    return this.hydrateRequirement(requirement);
  }

  async createRequirement(input: CreateRequirementDto): Promise<Requirement> {
    const requirementId = await this.dataSource.transaction(async (manager) => {
      const projectRepository = manager.getRepository(ProjectEntity);
      const project = await projectRepository.findOneBy({
        id: input.projectId,
      });
      if (!project) throw new NotFoundException('未找到项目');
      if (input.versionId)
        await this.assertVersionInProject(manager, input.versionId, project.id);

      project.requirementSequence += 1;
      await projectRepository.save(project);
      const requirement = manager.getRepository(RequirementEntity).create({
        id: randomUUID(),
        key: `${project.key}-${project.requirementSequence}`,
        projectId: project.id,
        versionId: input.versionId ?? null,
        title: input.title,
        description: input.description ?? null,
        ownerIds: input.ownerIds ?? [],
        lifecycle: 'not_started',
        baselineStartAt: date(input.plannedStartAt),
        baselineEndAt: date(input.plannedEndAt),
        plannedStartAt: date(input.plannedStartAt),
        plannedEndAt: date(input.plannedEndAt),
        actualStartAt: null,
        actualEndAt: null,
      });
      await manager.save(requirement);
      const templateIdMap = new Map<string, string>();
      for (const stage of project.templateStages)
        templateIdMap.set(stage.id, randomUUID());
      const stages = project.templateStages.map((template) =>
        manager.getRepository(StageEntity).create({
          id: templateIdMap.get(template.id),
          requirementId: requirement.id,
          name: template.name,
          order: template.order,
          ownerIds: template.ownerIds,
          status: 'not_started',
          note: null,
          statusReason: null,
          expectedResumeAt: null,
          baselineStartAt: null,
          baselineEndAt: null,
          plannedStartAt: null,
          plannedEndAt: null,
          actualStartAt: null,
          actualEndAt: null,
        }),
      );
      await manager.save(stages);
      for (const template of project.templateStages) {
        for (const predecessorTemplateId of template.dependsOnTemplateStageIds) {
          const successorId = templateIdMap.get(template.id);
          const predecessorId = templateIdMap.get(predecessorTemplateId);
          if (!successorId || !predecessorId) continue;
          await manager.save(
            manager.getRepository(DependencyEntity).create({
              id: randomUUID(),
              successorType: 'stage',
              successorId,
              predecessorType: 'stage',
              predecessorId,
              note: '由项目模板复制',
              active: true,
              source: context(input).source,
              agentName: input.agentName ?? null,
              resolvedAt: null,
            }),
          );
        }
      }
      await this.recordChange(manager, {
        entityType: 'requirement',
        entityId: requirement.id,
        projectId: project.id,
        requirementId: requirement.id,
        type: 'requirement_created',
        summary: `创建需求 ${requirement.key}「${requirement.title}」`,
        details: {
          versionId: requirement.versionId,
          stageCount: stages.length,
        },
        ...context(input),
      });
      return requirement.id;
    });
    return this.getRequirement(requirementId);
  }

  async updateRequirement(
    id: string,
    input: UpdateRequirementDto,
  ): Promise<Requirement> {
    const requirement = await this.findRequirement(id);
    if (input.title !== undefined) requirement.title = input.title;
    if (input.description !== undefined)
      requirement.description = input.description || null;
    if (input.ownerIds !== undefined) requirement.ownerIds = input.ownerIds;
    if (input.lifecycle !== undefined) requirement.lifecycle = input.lifecycle;
    await this.requirements.save(requirement);
    return this.getRequirement(requirement.id);
  }

  async moveRequirement(
    id: string,
    input: MoveVersionDto,
  ): Promise<Requirement> {
    const requirement = await this.findRequirement(id);
    if (input.versionId) {
      await this.assertVersionInProject(
        this.dataSource.manager,
        input.versionId,
        requirement.projectId,
      );
    }
    const nextVersionId = input.versionId ?? null;
    if (nextVersionId === requirement.versionId)
      return this.getRequirement(requirement.id);
    await this.dataSource.transaction(async (manager) => {
      const fromVersionId = requirement.versionId;
      requirement.versionId = nextVersionId;
      await manager.save(requirement);
      await manager.save(
        manager.getRepository(VersionHistoryEntity).create({
          id: randomUUID(),
          requirementId: requirement.id,
          fromVersionId,
          toVersionId: nextVersionId,
          reason: input.reason ?? null,
          source: context(input).source,
          agentName: input.agentName ?? null,
        }),
      );
      await this.recordChange(manager, {
        entityType: 'requirement',
        entityId: requirement.id,
        projectId: requirement.projectId,
        requirementId: requirement.id,
        type: 'requirement_version_changed',
        summary: `${requirement.key} 调整目标版本`,
        details: { fromVersionId, toVersionId: nextVersionId },
        ...context(input),
      });
    });
    return this.getRequirement(requirement.id);
  }

  async rescheduleRequirement(
    id: string,
    input: RescheduleDto,
  ): Promise<Requirement> {
    const requirement = await this.findRequirement(id);
    await this.reschedule('requirement', requirement, input);
    return this.getRequirement(requirement.id);
  }

  async addStage(requirementId: string, input: CreateStageDto): Promise<Stage> {
    const requirement = await this.findRequirement(requirementId);
    const maxOrder = await this.stages.maximum('order', {
      requirementId: requirement.id,
    });
    const stage = this.stages.create({
      id: randomUUID(),
      requirementId: requirement.id,
      name: input.name,
      order: input.order ?? (maxOrder ?? -1) + 1,
      ownerIds: input.ownerIds ?? [],
      status: 'not_started',
      note: input.note ?? null,
      statusReason: null,
      expectedResumeAt: null,
      baselineStartAt: date(input.plannedStartAt),
      baselineEndAt: date(input.plannedEndAt),
      plannedStartAt: date(input.plannedStartAt),
      plannedEndAt: date(input.plannedEndAt),
      actualStartAt: null,
      actualEndAt: null,
    });
    await this.stages.save(stage);
    await this.recordChange(this.dataSource.manager, {
      entityType: 'stage',
      entityId: stage.id,
      projectId: requirement.projectId,
      requirementId: requirement.id,
      type: 'stage_added',
      summary: `${requirement.key} 新增阶段「${stage.name}」`,
      ...context(input),
    });
    return this.toStage(stage, [], []);
  }

  async updateStage(id: string, input: UpdateStageDto): Promise<Stage> {
    const stage = await this.findStage(id);
    if (input.name !== undefined) stage.name = input.name;
    if (input.ownerIds !== undefined) stage.ownerIds = input.ownerIds;
    if (input.note !== undefined) stage.note = input.note || null;
    if (input.order !== undefined) stage.order = input.order;
    await this.stages.save(stage);
    return this.getStage(stage.id);
  }

  async updateStageStatus(id: string, input: UpdateStatusDto): Promise<Stage> {
    const stage = await this.findStage(id);
    await this.changeStatus('stage', stage, input);
    return this.getStage(stage.id);
  }

  async rescheduleStage(id: string, input: RescheduleDto): Promise<Stage> {
    const stage = await this.findStage(id);
    await this.reschedule('stage', stage, input);
    return this.getStage(stage.id);
  }

  async deleteStage(id: string): Promise<void> {
    const stage = await this.findStage(id);
    await this.assertDeletable('stage', stage.id);
    await this.stages.remove(stage);
  }

  async reportBug(requirementId: string, input: CreateBugDto): Promise<Bug> {
    const requirement = await this.findRequirement(requirementId);
    if (input.discoveredStageId) {
      const stage = await this.findStage(input.discoveredStageId);
      if (stage.requirementId !== requirement.id) {
        throw new BadRequestException('发现阶段不属于该需求');
      }
    }
    if (input.targetVersionId) {
      await this.assertVersionInProject(
        this.dataSource.manager,
        input.targetVersionId,
        requirement.projectId,
      );
    }
    const bugId = await this.dataSource.transaction(async (manager) => {
      const project = await manager.getRepository(ProjectEntity).findOneBy({
        id: requirement.projectId,
      });
      if (!project) throw new NotFoundException('未找到项目');
      project.bugSequence += 1;
      await manager.save(project);
      const bug = manager.getRepository(BugEntity).create({
        id: randomUUID(),
        key: `${project.key}-BUG-${project.bugSequence}`,
        requirementId: requirement.id,
        title: input.title,
        description: input.description ?? null,
        ownerIds: input.ownerIds ?? [],
        status: 'not_started',
        statusReason: null,
        expectedResumeAt: null,
        discoveredStageId: input.discoveredStageId ?? null,
        discoveredVersionId: input.discoveredVersionId ?? requirement.versionId,
        targetVersionId: input.targetVersionId ?? requirement.versionId,
        baselineStartAt: date(input.plannedStartAt),
        baselineEndAt: date(input.plannedEndAt),
        plannedStartAt: date(input.plannedStartAt),
        plannedEndAt: date(input.plannedEndAt),
        actualStartAt: null,
        actualEndAt: null,
      });
      await manager.save(bug);
      await this.recordChange(manager, {
        entityType: 'bug',
        entityId: bug.id,
        projectId: requirement.projectId,
        requirementId: requirement.id,
        type: 'bug_reported',
        summary: `${requirement.key} 新增 ${bug.key}「${bug.title}」`,
        ...context(input),
      });
      return bug.id;
    });
    return this.getBug(bugId);
  }

  async updateBug(id: string, input: UpdateBugDto): Promise<Bug> {
    const bug = await this.findBug(id);
    if (input.title !== undefined) bug.title = input.title;
    if (input.description !== undefined)
      bug.description = input.description || null;
    if (input.ownerIds !== undefined) bug.ownerIds = input.ownerIds;
    if (input.targetVersionId !== undefined)
      bug.targetVersionId = input.targetVersionId || null;
    await this.bugs.save(bug);
    return this.getBug(bug.id);
  }

  async updateBugStatus(id: string, input: UpdateStatusDto): Promise<Bug> {
    const bug = await this.findBug(id);
    await this.changeStatus('bug', bug, input);
    return this.getBug(bug.id);
  }

  async rescheduleBug(id: string, input: RescheduleDto): Promise<Bug> {
    const bug = await this.findBug(id);
    await this.reschedule('bug', bug, input);
    return this.getBug(bug.id);
  }

  async deleteBug(id: string): Promise<void> {
    const bug = await this.findBug(id);
    await this.assertDeletable('bug', bug.id);
    await this.bugs.remove(bug);
  }

  async correctStatusHistory(
    id: string,
    input: CorrectStatusHistoryDto,
  ): Promise<Stage | Bug> {
    const history = await this.statuses.findOneBy({ id });
    if (!history) throw new NotFoundException('未找到状态历史');
    if (input.status !== undefined) history.toStatus = input.status;
    if (input.effectiveAt !== undefined)
      history.effectiveAt = new Date(input.effectiveAt);
    if (input.note !== undefined) history.note = input.note || null;
    if (input.statusReason !== undefined)
      history.reason = input.statusReason || null;
    if (input.expectedResumeAt !== undefined)
      history.expectedResumeAt = date(input.expectedResumeAt);
    await this.dataSource.transaction(async (manager) => {
      await manager.save(history);
      await this.recomputeTrackable(
        manager,
        history.entityType,
        history.entityId,
      );
      const entity =
        history.entityType === 'stage'
          ? await manager
              .getRepository(StageEntity)
              .findOneBy({ id: history.entityId })
          : await manager
              .getRepository(BugEntity)
              .findOneBy({ id: history.entityId });
      if (entity)
        await this.recomputeRequirement(manager, entity.requirementId);
    });
    return history.entityType === 'stage'
      ? this.getStage(history.entityId)
      : this.getBug(history.entityId);
  }

  async listDependencies(requirementId?: string): Promise<Dependency[]> {
    const rows = await this.dependencyRepository.find({
      where: { active: true },
      order: { createdAt: 'DESC' },
    });
    const hydrated = await Promise.all(
      rows.map((row) => this.toDependency(row)),
    );
    if (!requirementId) return hydrated;
    return hydrated.filter(
      (item) =>
        item.predecessor?.requirementId === requirementId ||
        item.successor?.requirementId === requirementId,
    );
  }

  async addDependency(input: CreateDependencyDto): Promise<Dependency> {
    if (
      input.successorType === input.predecessorType &&
      input.successorId === input.predecessorId
    ) {
      throw new BadRequestException('事项不能依赖自身');
    }
    const [successor, predecessor] = await Promise.all([
      this.getTargetSummary(input.successorType, input.successorId),
      this.getTargetSummary(input.predecessorType, input.predecessorId),
    ]);
    const existing = await this.dependencyRepository.findOneBy({
      successorType: input.successorType,
      successorId: successor.id,
      predecessorType: input.predecessorType,
      predecessorId: predecessor.id,
      active: true,
    });
    if (existing) return this.toDependency(existing);
    const dependency = this.dependencyRepository.create({
      id: randomUUID(),
      successorType: input.successorType,
      successorId: successor.id,
      predecessorType: input.predecessorType,
      predecessorId: predecessor.id,
      note: input.note ?? null,
      active: true,
      source: context(input).source,
      agentName: input.agentName ?? null,
      resolvedAt: null,
    });
    await this.dependencyRepository.save(dependency);
    await this.recordChange(this.dataSource.manager, {
      entityType: 'dependency',
      entityId: dependency.id,
      projectId: successor.projectId,
      requirementId: successor.requirementId,
      type: 'dependency_added',
      summary: `${successor.name} 开始依赖 ${predecessor.projectName} / ${predecessor.name}`,
      details: { successor, predecessor },
      ...context(input),
    });
    return this.toDependency(dependency);
  }

  async resolveDependency(
    id: string,
    change: ChangeContext,
  ): Promise<Dependency> {
    const dependency = await this.dependencyRepository.findOneBy({ id });
    if (!dependency) throw new NotFoundException('未找到依赖关系');
    dependency.active = false;
    dependency.resolvedAt = new Date();
    await this.dependencyRepository.save(dependency);
    return this.toDependency(dependency);
  }

  async getChanges(since: string, projectId?: string): Promise<ChangeEvent[]> {
    const rows = await this.changes.find({
      where: {
        occurredAt: MoreThanOrEqual(new Date(since)),
        ...(projectId ? { projectId } : {}),
      },
      order: { occurredAt: 'DESC' },
      take: 300,
    });
    return rows.map((item) => this.toChange(item));
  }

  async getProjectSnapshot(projectId: string): Promise<ProjectSnapshot> {
    const project = await this.findProject(projectId);
    const versions = await this.listVersions(project.id);
    return this.buildSnapshot(project, versions);
  }

  async getVersionSnapshot(versionId: string): Promise<VersionSnapshot> {
    const versionEntity = await this.versions.findOneBy({ id: versionId });
    if (!versionEntity) throw new NotFoundException('未找到版本');
    const project = await this.findProject(versionEntity.projectId);
    const base = await this.buildSnapshot(
      project,
      [this.toVersion(versionEntity)],
      versionId,
    );
    return { ...base, version: this.toVersion(versionEntity) };
  }

  async batch(
    input: BatchDto,
  ): Promise<
    Array<{ index: number; success: boolean; data?: unknown; error?: string }>
  > {
    const inherited = context(input);
    const results = [];
    for (const [index, operation] of input.operations.entries()) {
      const payload = { ...operation.payload, ...inherited } as never;
      try {
        let data: unknown;
        switch (operation.type) {
          case 'update_stage_status':
            data = await this.updateStageStatus(operation.targetId, payload);
            break;
          case 'update_bug_status':
            data = await this.updateBugStatus(operation.targetId, payload);
            break;
          case 'move_requirement':
            data = await this.moveRequirement(operation.targetId, payload);
            break;
          case 'reschedule_stage':
            data = await this.rescheduleStage(operation.targetId, payload);
            break;
          case 'create_bug':
            data = await this.reportBug(operation.targetId, payload);
            break;
          default:
            throw new BadRequestException(
              `不支持的批量操作：${operation.type}`,
            );
        }
        results.push({ index, success: true, data });
      } catch (error) {
        results.push({
          index,
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    }
    return results;
  }

  calculateDurations(
    history: StatusHistory[],
    now = new Date(),
  ): StatusDuration {
    const sorted = [...history].sort(
      (a, b) =>
        new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime(),
    );
    const duration: StatusDuration = {
      inProgressMs: 0,
      waitingMs: 0,
      blockedMs: 0,
      totalSpanMs: 0,
    };
    if (!sorted.length) return duration;
    for (let index = 0; index < sorted.length; index += 1) {
      const item = sorted[index];
      if (!item) continue;
      const next = sorted[index + 1];
      const start = new Date(item.effectiveAt).getTime();
      const end = next ? new Date(next.effectiveAt).getTime() : now.getTime();
      const span = Math.max(0, end - start);
      if (item.toStatus === 'in_progress') duration.inProgressMs += span;
      if (item.toStatus === 'waiting') duration.waitingMs += span;
      if (item.toStatus === 'blocked') duration.blockedMs += span;
    }
    duration.totalSpanMs = Math.max(
      0,
      now.getTime() - new Date(sorted[0]?.effectiveAt ?? now).getTime(),
    );
    return duration;
  }

  private async changeStatus(
    kind: 'stage' | 'bug',
    entity: TrackableEntity,
    input: UpdateStatusDto,
  ): Promise<void> {
    if (
      (input.status === 'waiting' || input.status === 'blocked') &&
      !input.statusReason?.trim()
    ) {
      throw new BadRequestException('进入等待中或阻塞时必须填写原因');
    }
    const requirement = await this.findRequirement(entity.requirementId);
    await this.dataSource.transaction(async (manager) => {
      await manager.save(
        manager.getRepository(StatusHistoryEntity).create({
          id: randomUUID(),
          entityType: kind,
          entityId: entity.id,
          fromStatus: null,
          toStatus: input.status,
          effectiveAt: date(input.effectiveAt) ?? new Date(),
          note: input.note ?? null,
          reason: input.statusReason ?? input.reason ?? null,
          expectedResumeAt: date(input.expectedResumeAt),
          source: context(input).source,
          agentName: input.agentName ?? null,
        }),
      );
      await this.recomputeTrackable(manager, kind, entity.id);
      await this.recomputeRequirement(manager, requirement.id);
      const name =
        kind === 'stage'
          ? (entity as StageEntity).name
          : (entity as BugEntity).key;
      await this.recordChange(manager, {
        entityType: kind,
        entityId: entity.id,
        projectId: requirement.projectId,
        requirementId: requirement.id,
        type: `${kind}_status_changed`,
        summary: `${name} 状态更新为 ${this.statusLabel(input.status)}`,
        details: {
          fromStatus: entity.status,
          toStatus: input.status,
          effectiveAt: input.effectiveAt,
        },
        ...context(input),
      });
    });
  }

  private async reschedule(
    kind: EntityKind,
    entity: SchedulableEntity,
    input: RescheduleDto,
  ): Promise<void> {
    const requirement =
      kind === 'requirement'
        ? (entity as RequirementEntity)
        : await this.findRequirement(
            (entity as StageEntity | BugEntity).requirementId,
          );
    const oldStart = entity.plannedStartAt;
    const oldEnd = entity.plannedEndAt;
    const nextStart =
      input.plannedStartAt === undefined
        ? entity.plannedStartAt
        : date(input.plannedStartAt);
    const nextEnd =
      input.plannedEndAt === undefined
        ? entity.plannedEndAt
        : date(input.plannedEndAt);
    await this.dataSource.transaction(async (manager) => {
      await manager.save(
        manager.getRepository(ScheduleHistoryEntity).create({
          id: randomUUID(),
          entityType: kind,
          entityId: entity.id,
          oldStartAt: oldStart,
          oldEndAt: oldEnd,
          newStartAt: nextStart,
          newEndAt: nextEnd,
          reason: input.reason ?? null,
          source: context(input).source,
          agentName: input.agentName ?? null,
        }),
      );
      if (!entity.baselineStartAt && nextStart)
        entity.baselineStartAt = nextStart;
      if (!entity.baselineEndAt && nextEnd) entity.baselineEndAt = nextEnd;
      entity.plannedStartAt = nextStart;
      entity.plannedEndAt = nextEnd;
      await manager.save(entity);
      await this.recordChange(manager, {
        entityType: kind,
        entityId: entity.id,
        projectId: requirement.projectId,
        requirementId: requirement.id,
        type: `${kind}_rescheduled`,
        summary: `${kind === 'stage' ? (entity as StageEntity).name : kind === 'bug' ? (entity as BugEntity).key : requirement.key} 调整排期`,
        details: {
          oldStartAt: iso(oldStart),
          oldEndAt: iso(oldEnd),
          newStartAt: iso(nextStart),
          newEndAt: iso(nextEnd),
        },
        ...context(input),
      });
    });
  }

  private async recomputeTrackable(
    manager: EntityManager,
    kind: 'stage' | 'bug',
    entityId: string,
  ): Promise<void> {
    const history = await manager.getRepository(StatusHistoryEntity).find({
      where: { entityType: kind, entityId },
      order: { effectiveAt: 'ASC', createdAt: 'ASC' },
    });
    const latest = history.at(-1);
    if (!latest) return;
    let previousStatus: ExecutionStatus | null = null;
    for (const item of history) {
      item.fromStatus = previousStatus;
      previousStatus = item.toStatus;
    }
    await manager.getRepository(StatusHistoryEntity).save(history);
    const repository = manager.getRepository(
      kind === 'stage' ? StageEntity : BugEntity,
    );
    const entity = await repository.findOneBy({ id: entityId });
    if (!entity) return;
    entity.status = latest.toStatus;
    entity.statusReason =
      latest.toStatus === 'waiting' || latest.toStatus === 'blocked'
        ? latest.reason
        : null;
    entity.expectedResumeAt = latest.expectedResumeAt;
    entity.actualStartAt =
      history.find((item) => item.toStatus === 'in_progress')?.effectiveAt ??
      null;
    entity.actualEndAt = latest.toStatus === 'done' ? latest.effectiveAt : null;
    await repository.save(entity);
  }

  private async recomputeRequirement(
    manager: EntityManager,
    requirementId: string,
  ): Promise<void> {
    const requirement = await manager
      .getRepository(RequirementEntity)
      .findOneBy({
        id: requirementId,
      });
    if (!requirement || requirement.lifecycle === 'canceled') return;
    const [stages, bugs] = await Promise.all([
      manager.getRepository(StageEntity).findBy({ requirementId }),
      manager.getRepository(BugEntity).findBy({ requirementId }),
    ]);
    const work = [...stages, ...bugs];
    const started = work
      .filter((item) => item.actualStartAt)
      .map((item) => item.actualStartAt as Date);
    const active = work.filter((item) => item.status !== 'canceled');
    const isDone =
      active.length > 0 && active.every((item) => item.status === 'done');
    requirement.lifecycle = isDone
      ? 'done'
      : started.length
        ? 'in_progress'
        : 'not_started';
    requirement.actualStartAt = started.length
      ? new Date(Math.min(...started.map((item) => item.getTime())))
      : null;
    requirement.actualEndAt = isDone
      ? new Date(
          Math.max(...active.map((item) => item.actualEndAt?.getTime() ?? 0)),
        )
      : null;
    await manager.save(requirement);
  }

  private async assertDeletable(
    kind: 'stage' | 'bug',
    id: string,
  ): Promise<void> {
    const [historyCount, scheduleCount, dependencyCount] = await Promise.all([
      this.statuses.countBy({ entityType: kind, entityId: id }),
      this.schedules.countBy({ entityType: kind, entityId: id }),
      this.dependencyRepository.count({
        where: [
          { successorType: kind, successorId: id },
          { predecessorType: kind, predecessorId: id },
        ],
      }),
    ]);
    if (historyCount || scheduleCount || dependencyCount) {
      throw new BadRequestException(
        '该事项已有历史或依赖关系，请改为已取消以保留记录',
      );
    }
  }

  private async getStage(id: string): Promise<Stage> {
    const stage = await this.findStage(id);
    const [statuses, schedules] = await Promise.all([
      this.statuses.find({
        where: { entityType: 'stage', entityId: id },
        order: { effectiveAt: 'ASC' },
      }),
      this.schedules.find({
        where: { entityType: 'stage', entityId: id },
        order: { changedAt: 'ASC' },
      }),
    ]);
    return this.toStage(stage, statuses, schedules);
  }

  private async getBug(id: string): Promise<Bug> {
    const bug = await this.findBug(id);
    const [statuses, schedules] = await Promise.all([
      this.statuses.find({
        where: { entityType: 'bug', entityId: id },
        order: { effectiveAt: 'ASC' },
      }),
      this.schedules.find({
        where: { entityType: 'bug', entityId: id },
        order: { changedAt: 'ASC' },
      }),
    ]);
    return this.toBug(bug, statuses, schedules);
  }

  private async hydrateRequirement(
    requirement: RequirementEntity,
  ): Promise<Requirement> {
    const [stageRows, bugRows, histories, schedules, versionHistories] =
      await Promise.all([
        this.stages.find({
          where: { requirementId: requirement.id },
          order: { order: 'ASC' },
        }),
        this.bugs.find({
          where: { requirementId: requirement.id },
          order: { createdAt: 'ASC' },
        }),
        this.statuses.find({ order: { effectiveAt: 'ASC' } }),
        this.schedules.find({ order: { changedAt: 'ASC' } }),
        this.versionHistory.find({
          where: { requirementId: requirement.id },
          order: { changedAt: 'ASC' },
        }),
      ]);
    const stageIds = new Set(stageRows.map((item) => item.id));
    const bugIds = new Set(bugRows.map((item) => item.id));
    const stages = stageRows.map((item) =>
      this.toStage(
        item,
        histories.filter(
          (history) =>
            history.entityType === 'stage' &&
            stageIds.has(history.entityId) &&
            history.entityId === item.id,
        ),
        schedules.filter(
          (history) =>
            history.entityType === 'stage' &&
            stageIds.has(history.entityId) &&
            history.entityId === item.id,
        ),
      ),
    );
    const bugs = bugRows.map((item) =>
      this.toBug(
        item,
        histories.filter(
          (history) =>
            history.entityType === 'bug' &&
            bugIds.has(history.entityId) &&
            history.entityId === item.id,
        ),
        schedules.filter(
          (history) =>
            history.entityType === 'bug' &&
            bugIds.has(history.entityId) &&
            history.entityId === item.id,
        ),
      ),
    );
    return {
      id: requirement.id,
      key: requirement.key,
      projectId: requirement.projectId,
      versionId: requirement.versionId ?? undefined,
      title: requirement.title,
      description: requirement.description ?? undefined,
      ownerIds: requirement.ownerIds,
      lifecycle: requirement.lifecycle,
      health: this.healthOf([...stages, ...bugs]),
      stages,
      bugs,
      versionHistory: versionHistories.map((item) =>
        this.toVersionHistory(item),
      ),
      ...this.timing(requirement),
      createdAt: requirement.createdAt.toISOString(),
      updatedAt: requirement.updatedAt.toISOString(),
    };
  }

  private async getRequirementSummary(
    row: RequirementEntity,
  ): Promise<RequirementSummary> {
    const requirement = await this.hydrateRequirement(row);
    const current =
      requirement.stages.find((stage) => stage.status === 'blocked') ??
      requirement.stages.find((stage) => stage.status === 'waiting') ??
      requirement.stages.find((stage) => stage.status === 'in_progress') ??
      requirement.stages.find(
        (stage) => !['done', 'canceled'].includes(stage.status),
      );
    return {
      id: requirement.id,
      key: requirement.key,
      projectId: requirement.projectId,
      versionId: requirement.versionId,
      title: requirement.title,
      description: requirement.description,
      ownerIds: requirement.ownerIds,
      lifecycle: requirement.lifecycle,
      health: requirement.health,
      ...this.timing(row),
      createdAt: requirement.createdAt,
      updatedAt: requirement.updatedAt,
      stageCount: requirement.stages.length,
      bugCount: requirement.bugs.length,
      completedBugCount: requirement.bugs.filter((bug) => bug.status === 'done')
        .length,
      currentStage: current?.name,
      overdue: this.isOverdue(row),
    };
  }

  private async buildSnapshot(
    project: ProjectEntity,
    versions: Version[],
    versionId?: string,
  ): Promise<ProjectSnapshot> {
    const requirements = await this.listRequirements({
      projectId: project.id,
      ...(versionId ? { versionId } : {}),
    });
    const full = await Promise.all(
      requirements.map((item) => this.getRequirement(item.id)),
    );
    const allWork = full.flatMap((item) => [...item.stages, ...item.bugs]);
    const dependencyRows = await this.listDependencies();
    const requirementIds = new Set(requirements.map((item) => item.id));
    const externalDependencies = dependencyRows.filter(
      (item) =>
        item.successor &&
        requirementIds.has(item.successor.requirementId) &&
        item.predecessor?.projectId !== project.id,
    );
    const recentChanges = await this.changes.find({
      where: { projectId: project.id },
      order: { occurredAt: 'DESC' },
      take: 20,
    });
    return {
      project: await this.toProject(project, true),
      versions,
      metrics: {
        total: requirements.length,
        completed: requirements.filter((item) => item.lifecycle === 'done')
          .length,
        inProgress: requirements.filter(
          (item) => item.lifecycle === 'in_progress',
        ).length,
        waiting: requirements.filter((item) => item.health === 'waiting')
          .length,
        blocked: requirements.filter((item) => item.health === 'blocked')
          .length,
        overdue: requirements.filter((item) => item.overdue).length,
        openBugs: requirements.reduce(
          (total, item) => total + item.bugCount - item.completedBugCount,
          0,
        ),
      },
      requirements,
      waitingItems: allWork
        .filter((item) => item.status === 'waiting')
        .map((item) => ({
          id: item.id,
          key: 'key' in item ? item.key : undefined,
          name: 'title' in item ? item.title : item.name,
          reason: item.statusReason,
        })),
      blockedItems: allWork
        .filter((item) => item.status === 'blocked')
        .map((item) => ({
          id: item.id,
          key: 'key' in item ? item.key : undefined,
          name: 'title' in item ? item.title : item.name,
          reason: item.statusReason,
        })),
      externalDependencies,
      recentChanges: recentChanges.map((item) => this.toChange(item)),
      generatedAt: new Date().toISOString(),
    };
  }

  private async toProject(
    row: ProjectEntity,
    includeMetrics = false,
  ): Promise<Project> {
    let metrics;
    if (includeMetrics) {
      const requirements = await this.listRequirements({ projectId: row.id });
      metrics = {
        incompleteRequirements: requirements.filter(
          (item) => !['done', 'canceled'].includes(item.lifecycle),
        ).length,
        waiting: requirements.filter((item) => item.health === 'waiting')
          .length,
        blocked: requirements.filter((item) => item.health === 'blocked')
          .length,
        overdue: requirements.filter((item) => item.overdue).length,
      };
    }
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description ?? undefined,
      templateStages: row.templateStages,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      metrics,
    };
  }

  private toProjectRhythm(row: ProjectRhythmEntity): ProjectRhythm {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      stages: row.stages,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toPerson(row: PersonEntity): Person {
    return {
      id: row.id,
      name: row.name,
      note: row.note ?? undefined,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toVersion(row: VersionEntity): Version {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      status: row.status,
      plannedStartAt: iso(row.plannedStartAt),
      plannedReleaseAt: iso(row.plannedReleaseAt),
      actualReleaseAt: iso(row.actualReleaseAt),
      description: row.description ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toStage(
    row: StageEntity,
    statusHistory: StatusHistoryEntity[],
    scheduleHistory: ScheduleHistoryEntity[],
  ): Stage {
    return {
      id: row.id,
      requirementId: row.requirementId,
      name: row.name,
      order: row.order,
      ownerIds: row.ownerIds,
      status: row.status,
      note: row.note ?? undefined,
      statusReason: row.statusReason ?? undefined,
      expectedResumeAt: iso(row.expectedResumeAt),
      statusHistory: statusHistory.map((item) => this.toStatusHistory(item)),
      scheduleHistory: scheduleHistory.map((item) =>
        this.toScheduleHistory(item),
      ),
      ...this.timing(row),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toBug(
    row: BugEntity,
    statusHistory: StatusHistoryEntity[],
    scheduleHistory: ScheduleHistoryEntity[],
  ): Bug {
    return {
      id: row.id,
      key: row.key,
      requirementId: row.requirementId,
      title: row.title,
      description: row.description ?? undefined,
      ownerIds: row.ownerIds,
      status: row.status,
      statusReason: row.statusReason ?? undefined,
      expectedResumeAt: iso(row.expectedResumeAt),
      discoveredStageId: row.discoveredStageId ?? undefined,
      discoveredVersionId: row.discoveredVersionId ?? undefined,
      targetVersionId: row.targetVersionId ?? undefined,
      statusHistory: statusHistory.map((item) => this.toStatusHistory(item)),
      scheduleHistory: scheduleHistory.map((item) =>
        this.toScheduleHistory(item),
      ),
      ...this.timing(row),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toStatusHistory(row: StatusHistoryEntity): StatusHistory {
    return {
      id: row.id,
      fromStatus: row.fromStatus ?? undefined,
      toStatus: row.toStatus,
      effectiveAt: row.effectiveAt.toISOString(),
      note: row.note ?? undefined,
      reason: row.reason ?? undefined,
      expectedResumeAt: iso(row.expectedResumeAt),
      source: row.source,
      agentName: row.agentName ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toScheduleHistory(row: ScheduleHistoryEntity): ScheduleHistory {
    return {
      id: row.id,
      oldStartAt: iso(row.oldStartAt),
      oldEndAt: iso(row.oldEndAt),
      newStartAt: iso(row.newStartAt),
      newEndAt: iso(row.newEndAt),
      reason: row.reason ?? undefined,
      source: row.source,
      agentName: row.agentName ?? undefined,
      changedAt: row.changedAt.toISOString(),
    };
  }

  private toVersionHistory(row: VersionHistoryEntity): VersionHistory {
    return {
      id: row.id,
      fromVersionId: row.fromVersionId ?? undefined,
      toVersionId: row.toVersionId ?? undefined,
      reason: row.reason ?? undefined,
      source: row.source,
      agentName: row.agentName ?? undefined,
      changedAt: row.changedAt.toISOString(),
    };
  }

  private async toDependency(row: DependencyEntity): Promise<Dependency> {
    const [successor, predecessor] = await Promise.all([
      this.getTargetSummary(row.successorType, row.successorId),
      this.getTargetSummary(row.predecessorType, row.predecessorId),
    ]);
    return {
      id: row.id,
      successorType: row.successorType,
      successorId: row.successorId,
      predecessorType: row.predecessorType,
      predecessorId: row.predecessorId,
      note: row.note ?? undefined,
      active: row.active,
      source: row.source,
      agentName: row.agentName ?? undefined,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: iso(row.resolvedAt),
      successor,
      predecessor,
      satisfied: ['done', 'canceled'].includes(predecessor.status),
    };
  }

  private toChange(row: ChangeEventEntity): ChangeEvent {
    return {
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      projectId: row.projectId ?? undefined,
      requirementId: row.requirementId ?? undefined,
      type: row.type,
      summary: row.summary,
      details: row.details ?? undefined,
      source: row.source,
      agentName: row.agentName ?? undefined,
      occurredAt: row.occurredAt.toISOString(),
    };
  }

  private timing(row: SchedulableEntity) {
    return {
      baselineStartAt: iso(row.baselineStartAt),
      baselineEndAt: iso(row.baselineEndAt),
      plannedStartAt: iso(row.plannedStartAt),
      plannedEndAt: iso(row.plannedEndAt),
      actualStartAt: iso(row.actualStartAt),
      actualEndAt: iso(row.actualEndAt),
    };
  }

  private healthOf(items: Array<Stage | Bug>): HealthStatus {
    if (items.some((item) => item.status === 'blocked')) return 'blocked';
    if (items.some((item) => item.status === 'waiting')) return 'waiting';
    return 'normal';
  }

  private isOverdue(row: RequirementEntity): boolean {
    return Boolean(
      row.plannedEndAt &&
      row.plannedEndAt < new Date() &&
      !['done', 'canceled'].includes(row.lifecycle),
    );
  }

  private normalizeTemplate(
    stages: Array<{
      id?: string;
      name: string;
      ownerIds?: string[];
      dependsOnTemplateStageIds?: string[];
    }>,
  ): TemplateStage[] {
    const ids = stages.map((stage) => stage.id ?? randomUUID());
    return stages.map((stage, order) => ({
      id: ids[order] as string,
      name: stage.name,
      order,
      ownerIds: stage.ownerIds ?? [],
      dependsOnTemplateStageIds: (stage.dependsOnTemplateStageIds ?? []).filter(
        (id) => ids.includes(id),
      ),
    }));
  }

  private async getTargetSummary(
    type: DependencyTargetType,
    id: string,
  ): Promise<DependencyTargetSummary> {
    if (type === 'requirement') {
      const requirement = await this.findRequirement(id);
      const project = await this.findProject(requirement.projectId);
      return {
        id: requirement.id,
        key: requirement.key,
        name: requirement.title,
        projectId: project.id,
        projectName: project.name,
        requirementId: requirement.id,
        requirementKey: requirement.key,
        status: requirement.lifecycle,
      };
    }
    const entity =
      type === 'stage' ? await this.findStage(id) : await this.findBug(id);
    const requirement = await this.findRequirement(entity.requirementId);
    const project = await this.findProject(requirement.projectId);
    return {
      id: entity.id,
      key: type === 'bug' ? (entity as BugEntity).key : undefined,
      name:
        type === 'bug'
          ? (entity as BugEntity).title
          : (entity as StageEntity).name,
      projectId: project.id,
      projectName: project.name,
      requirementId: requirement.id,
      requirementKey: requirement.key,
      status: entity.status,
    };
  }

  private async findProject(idOrKey: string): Promise<ProjectEntity> {
    const project = await this.projects.findOne({
      where: [{ id: idOrKey }, { key: idOrKey.toUpperCase() }],
    });
    if (!project) throw new NotFoundException('未找到项目');
    return project;
  }

  private async findRequirement(idOrKey: string): Promise<RequirementEntity> {
    const requirement = await this.requirements.findOne({
      where: [{ id: idOrKey }, { key: idOrKey.toUpperCase() }],
    });
    if (!requirement) throw new NotFoundException('未找到需求');
    return requirement;
  }

  private async findStage(id: string): Promise<StageEntity> {
    const stage = await this.stages.findOneBy({ id });
    if (!stage) throw new NotFoundException('未找到阶段');
    return stage;
  }

  private async findBug(idOrKey: string): Promise<BugEntity> {
    const bug = await this.bugs.findOne({
      where: [{ id: idOrKey }, { key: idOrKey.toUpperCase() }],
    });
    if (!bug) throw new NotFoundException('未找到 Bug');
    return bug;
  }

  private async assertVersionInProject(
    manager: EntityManager,
    versionId: string,
    projectId: string,
  ): Promise<void> {
    const version = await manager
      .getRepository(VersionEntity)
      .findOneBy({ id: versionId });
    if (!version || version.projectId !== projectId) {
      throw new BadRequestException('目标版本不属于该项目');
    }
  }

  private statusLabel(status: ExecutionStatus): string {
    return {
      not_started: '待开始',
      in_progress: '进行中',
      waiting: '等待中',
      blocked: '阻塞',
      done: '已完成',
      canceled: '已取消',
    }[status];
  }

  private async recordChange(
    manager: EntityManager,
    input: {
      entityType: string;
      entityId: string;
      projectId?: string;
      requirementId?: string;
      type: string;
      summary: string;
      details?: Record<string, unknown>;
      source: 'manual' | 'api' | 'agent';
      agentName?: string;
    },
  ): Promise<void> {
    await manager.save(
      manager.getRepository(ChangeEventEntity).create({
        id: randomUUID(),
        entityType: input.entityType,
        entityId: input.entityId,
        projectId: input.projectId ?? null,
        requirementId: input.requirementId ?? null,
        type: input.type,
        summary: input.summary,
        details: input.details ?? null,
        source: input.source,
        agentName: input.agentName ?? null,
        occurredAt: new Date(),
      }),
    );
  }
}

export const workEntities = entities;
