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
  RequirementDetail,
  RequirementLifecycle,
  RequirementStageSummary,
  RequirementSummary,
  ScheduleHistory,
  SearchEntityType,
  SearchResult,
  SnapshotWorkItem,
  Stage,
  StatusDuration,
  StatusHistory,
  TemplateStage,
  Version,
  VersionHistory,
  VersionSnapshot,
} from '@flowtrace/shared';
import {
  reviewRequirement,
  searchEntityTypes,
  selectActiveStages,
  selectCurrentStage,
  selectNextStages,
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
  DeleteWorkItemDto,
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
type ChangeFilters = {
  since: string;
  projectId?: string;
  versionId?: string;
  requirementId?: string;
  limit?: number;
};

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
const normalizeSearchText = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, '');
const versionParts = (value: string) => {
  const match = value.normalize('NFKC').match(/(?:^|[^0-9])(\d+(?:\.\d+)+)/);
  return match?.[1]?.split('.').map(Number) ?? [];
};

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

  async search(
    query: string,
    types: SearchEntityType[] = [...searchEntityTypes],
    limit = 20,
  ): Promise<SearchResult[]> {
    const needle = query.trim().normalize('NFKC').toLocaleLowerCase();
    const compactNeedle = normalizeSearchText(query);
    const needleVersionParts = versionParts(query);
    const selected = new Set(types.length ? types : searchEntityTypes);
    const needsRequirements = ['requirement', 'stage', 'bug'].some((type) =>
      selected.has(type as SearchEntityType),
    );
    const needsProjects =
      needsRequirements || selected.has('project') || selected.has('version');
    const needsVersions = needsRequirements || selected.has('version');
    const [
      projectRows,
      versionRows,
      requirementRows,
      stageRows,
      bugRows,
      people,
    ] = await Promise.all([
      needsProjects ? this.projects.find() : [],
      needsVersions ? this.versions.find() : [],
      needsRequirements ? this.requirements.find() : [],
      selected.has('stage') ? this.stages.find() : [],
      selected.has('bug') ? this.bugs.find() : [],
      selected.has('person') ? this.people.find() : [],
    ]);
    const projects = new Map(projectRows.map((item) => [item.id, item]));
    const versions = new Map(versionRows.map((item) => [item.id, item]));
    const requirements = new Map(
      requirementRows.map((item) => [item.id, item]),
    );
    const candidates: Array<{ rank: number; result: SearchResult }> = [];
    const add = (
      result: SearchResult,
      values: Array<string | null | undefined>,
      versionFamilyValue?: string,
    ) => {
      const normalized = values
        .filter((value): value is string => Boolean(value))
        .map((value) => ({
          text: value.normalize('NFKC').toLocaleLowerCase(),
          compact: normalizeSearchText(value),
        }));
      if (!needle) {
        candidates.push({ rank: 3, result });
        return;
      }
      const versionFamilyMatch =
        versionFamilyValue !== undefined &&
        needleVersionParts.length >= 2 &&
        versionParts(versionFamilyValue).length >= 2 &&
        versionParts(versionFamilyValue).length < needleVersionParts.length &&
        versionParts(versionFamilyValue).every(
          (part, index) => needleVersionParts[index] === part,
        );
      if (
        !normalized.some(
          (value) =>
            value.text.includes(needle) ||
            (compactNeedle && value.compact.includes(compactNeedle)),
        ) &&
        !versionFamilyMatch
      )
        return;
      const rank = normalized.some(
        (value) => value.text === needle || value.compact === compactNeedle,
      )
        ? 0
        : normalized.some(
              (value) =>
                value.text.startsWith(needle) ||
                (compactNeedle && value.compact.startsWith(compactNeedle)),
            )
          ? 1
          : versionFamilyMatch
            ? 3
            : 2;
      candidates.push({ rank, result });
    };

    if (selected.has('project')) {
      for (const project of projectRows) {
        add(
          {
            type: 'project',
            id: project.id,
            key: project.key,
            name: project.name,
            projectId: project.id,
            projectName: project.name,
          },
          [project.key, project.name, project.description],
        );
      }
    }
    if (selected.has('version')) {
      for (const version of versionRows) {
        const project = projects.get(version.projectId);
        add(
          {
            type: 'version',
            id: version.id,
            name: version.name,
            projectId: version.projectId,
            projectName: project?.name,
            versionId: version.id,
            versionName: version.name,
            status: version.status,
          },
          [version.name, version.description, project?.name, project?.key],
          version.name,
        );
      }
    }
    if (selected.has('requirement')) {
      for (const requirement of requirementRows) {
        const project = projects.get(requirement.projectId);
        const version = requirement.versionId
          ? versions.get(requirement.versionId)
          : undefined;
        add(
          {
            type: 'requirement',
            id: requirement.id,
            key: requirement.key,
            name: requirement.title,
            projectId: requirement.projectId,
            projectName: project?.name,
            versionId: version?.id,
            versionName: version?.name,
            requirementId: requirement.id,
            requirementKey: requirement.key,
            status: requirement.lifecycle,
          },
          [
            requirement.key,
            requirement.title,
            requirement.description,
            project?.name,
            version?.name,
          ],
        );
      }
    }
    if (selected.has('stage')) {
      for (const stage of stageRows) {
        const requirement = requirements.get(stage.requirementId);
        if (!requirement) continue;
        const project = projects.get(requirement.projectId);
        const version = requirement.versionId
          ? versions.get(requirement.versionId)
          : undefined;
        add(
          {
            type: 'stage',
            id: stage.id,
            name: stage.name,
            projectId: requirement.projectId,
            projectName: project?.name,
            versionId: version?.id,
            versionName: version?.name,
            requirementId: requirement.id,
            requirementKey: requirement.key,
            status: stage.status,
          },
          [
            stage.name,
            stage.note,
            requirement.key,
            requirement.title,
            project?.name,
            version?.name,
          ],
        );
      }
    }
    if (selected.has('bug')) {
      for (const bug of bugRows) {
        const requirement = requirements.get(bug.requirementId);
        if (!requirement) continue;
        const project = projects.get(requirement.projectId);
        const version = requirement.versionId
          ? versions.get(requirement.versionId)
          : undefined;
        add(
          {
            type: 'bug',
            id: bug.id,
            key: bug.key,
            name: bug.title,
            projectId: requirement.projectId,
            projectName: project?.name,
            versionId: version?.id,
            versionName: version?.name,
            requirementId: requirement.id,
            requirementKey: requirement.key,
            status: bug.status,
          },
          [
            bug.key,
            bug.title,
            bug.description,
            requirement.key,
            requirement.title,
            project?.name,
            version?.name,
          ],
        );
      }
    }
    if (selected.has('person')) {
      for (const person of people) {
        add(
          {
            type: 'person',
            id: person.id,
            name: person.name,
            active: person.active,
          },
          [person.name, person.note],
        );
      }
    }

    return candidates
      .sort(
        (left, right) =>
          left.rank - right.rank ||
          left.result.type.localeCompare(right.result.type) ||
          left.result.name.localeCompare(right.result.name, 'zh-CN'),
      )
      .slice(0, Math.min(Math.max(limit, 1), 50))
      .map((item) => item.result);
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
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
    return rows.map((item) => this.toVersion(item));
  }

  async createVersion(
    projectId: string,
    input: CreateVersionDto,
  ): Promise<Version> {
    const project = await this.findProject(projectId);
    const last = (
      await this.versions.find({
        where: { projectId: project.id },
        order: { sortOrder: 'DESC' },
        take: 1,
      })
    )[0];
    const version = this.versions.create({
      id: randomUUID(),
      projectId: project.id,
      name: input.name,
      status: input.status ?? 'planning',
      sortOrder: (last?.sortOrder ?? -1) + 1,
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
    if (input.sortOrder !== undefined) version.sortOrder = input.sortOrder;
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

  async getRequirementDetail(idOrKey: string): Promise<RequirementDetail> {
    const entity = await this.findRequirement(idOrKey);
    const requirement = await this.hydrateRequirement(entity);
    const ownerIds = new Set([
      ...requirement.ownerIds,
      ...requirement.stages.flatMap((item) => item.ownerIds),
      ...requirement.bugs.flatMap((item) => item.ownerIds),
    ]);
    const [project, version, people, dependencies] = await Promise.all([
      this.toProject(await this.findProject(requirement.projectId)),
      requirement.versionId
        ? this.versions.findOneBy({ id: requirement.versionId })
        : undefined,
      ownerIds.size
        ? this.people.findBy({ id: In([...ownerIds]) })
        : Promise.resolve([]),
      this.listDependencies(requirement.id),
    ]);
    return {
      requirement,
      project,
      version: version ? this.toVersion(version) : undefined,
      people: people
        .map((item) => this.toPerson(item))
        .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')),
      dependencies,
    };
  }

  async createRequirement(input: CreateRequirementDto): Promise<Requirement> {
    if (input.stages?.some((stage) => !stage.name.trim())) {
      throw new BadRequestException('真实阶段名称不能为空');
    }
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
      const usesTemplate = input.stages === undefined;
      const sourceStages: Array<{
        id?: string;
        name: string;
        order: number;
        ownerIds?: string[];
        note?: string;
        plannedStartAt?: string;
        plannedEndAt?: string;
      }> =
        input.stages === undefined
          ? project.templateStages.map((template) => ({
              ...template,
              note: undefined,
              plannedStartAt: undefined,
              plannedEndAt: undefined,
            }))
          : input.stages.map((stage, order) => ({ ...stage, order }));
      const templateIdMap = new Map<string, string>();
      if (usesTemplate) {
        for (const stage of project.templateStages)
          templateIdMap.set(stage.id, randomUUID());
      }
      const stages = sourceStages.map((sourceStage) =>
        manager.getRepository(StageEntity).create({
          id:
            (sourceStage.id && templateIdMap.get(sourceStage.id)) ||
            randomUUID(),
          requirementId: requirement.id,
          name: sourceStage.name.trim(),
          order: sourceStage.order,
          ownerIds: usesTemplate ? [] : (sourceStage.ownerIds ?? []),
          status: 'not_started',
          note: sourceStage.note ?? null,
          statusReason: null,
          expectedResumeAt: null,
          baselineStartAt: date(sourceStage.plannedStartAt),
          baselineEndAt: date(sourceStage.plannedEndAt),
          plannedStartAt: date(sourceStage.plannedStartAt),
          plannedEndAt: date(sourceStage.plannedEndAt),
          actualStartAt: null,
          actualEndAt: null,
        }),
      );
      await manager.save(stages);
      if (usesTemplate) {
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
    if (
      input.title === undefined &&
      input.description === undefined &&
      input.ownerIds === undefined &&
      input.lifecycle === undefined
    ) {
      return this.getRequirement(requirement.id);
    }
    const before = {
      title: requirement.title,
      description: requirement.description,
      ownerIds: [...requirement.ownerIds],
      lifecycle: requirement.lifecycle,
    };
    await this.dataSource.transaction(async (manager) => {
      if (input.title !== undefined) requirement.title = input.title;
      if (input.description !== undefined)
        requirement.description = input.description || null;
      if (input.ownerIds !== undefined) requirement.ownerIds = input.ownerIds;
      if (input.lifecycle !== undefined)
        requirement.lifecycle = input.lifecycle;
      await manager.save(requirement);
      await this.recordChange(manager, {
        entityType: 'requirement',
        entityId: requirement.id,
        projectId: requirement.projectId,
        requirementId: requirement.id,
        type: 'requirement_updated',
        summary: `${requirement.key} 更新基本资料`,
        details: {
          before,
          after: {
            title: requirement.title,
            description: requirement.description,
            ownerIds: requirement.ownerIds,
            lifecycle: requirement.lifecycle,
          },
        },
        ...context(input),
      });
    });
    return this.getRequirement(requirement.id);
  }

  async deleteRequirement(id: string, input: DeleteWorkItemDto): Promise<void> {
    const requirement = await this.findRequirement(id);
    this.assertDeleteConfirmation(requirement.key, input.confirmation);
    await this.dataSource.transaction(async (manager) => {
      const [stages, bugs] = await Promise.all([
        manager.getRepository(StageEntity).findBy({ requirementId: id }),
        manager.getRepository(BugEntity).findBy({ requirementId: id }),
      ]);
      await this.deactivateDependencies(manager, [
        { type: 'requirement', id },
        ...stages.map((item) => ({ type: 'stage' as const, id: item.id })),
        ...bugs.map((item) => ({ type: 'bug' as const, id: item.id })),
      ]);
      await this.recordChange(manager, {
        entityType: 'requirement',
        entityId: requirement.id,
        projectId: requirement.projectId,
        type: 'requirement_deleted',
        summary: `删除需求 ${requirement.key}「${requirement.title}」`,
        details: { reason: input.reason },
        ...context(input),
      });
      await manager
        .getRepository(StageEntity)
        .softDelete({ requirementId: id });
      await manager.getRepository(BugEntity).softDelete({ requirementId: id });
      await manager.getRepository(RequirementEntity).softDelete(id);
    });
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
          effectiveAt: date(input.effectiveAt) ?? new Date(),
        }),
      );
      await this.recordChange(manager, {
        entityType: 'requirement',
        entityId: requirement.id,
        projectId: requirement.projectId,
        requirementId: requirement.id,
        type: 'requirement_version_changed',
        summary: `${requirement.key} 调整目标版本`,
        details: {
          fromVersionId,
          toVersionId: nextVersionId,
          effectiveAt: input.effectiveAt,
        },
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
    const stageId = await this.dataSource.transaction(async (manager) => {
      const requirement = await manager
        .getRepository(RequirementEntity)
        .findOneBy({ id: requirementId });
      if (!requirement) throw new NotFoundException('未找到需求');

      const stageRepository = manager.getRepository(StageEntity);
      const existing = await stageRepository.find({
        where: { requirementId: requirement.id },
        order: { order: 'ASC', createdAt: 'ASC' },
      });
      const targetOrder = Math.min(
        Math.max(input.order ?? existing.length, 0),
        existing.length,
      );
      existing.forEach((item, index) => {
        item.order = index >= targetOrder ? index + 1 : index;
      });
      await stageRepository.save(existing);

      const stage = stageRepository.create({
        id: randomUUID(),
        requirementId: requirement.id,
        name: input.name,
        order: targetOrder,
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
      await stageRepository.save(stage);
      await this.recordChange(manager, {
        entityType: 'stage',
        entityId: stage.id,
        projectId: requirement.projectId,
        requirementId: requirement.id,
        type: 'stage_added',
        summary: `${requirement.key} 新增阶段「${stage.name}」`,
        details: { order: targetOrder },
        ...context(input),
      });
      return stage.id;
    });
    return this.getStage(stageId);
  }

  async updateStage(id: string, input: UpdateStageDto): Promise<Stage> {
    await this.dataSource.transaction(async (manager) => {
      const stageRepository = manager.getRepository(StageEntity);
      const stage = await stageRepository.findOneBy({ id });
      if (!stage) throw new NotFoundException('未找到阶段');
      const requirement = await manager
        .getRepository(RequirementEntity)
        .findOneBy({ id: stage.requirementId });
      if (!requirement) throw new NotFoundException('未找到需求');

      const before = {
        name: stage.name,
        ownerIds: [...stage.ownerIds],
        note: stage.note,
        order: stage.order,
      };

      if (input.name !== undefined) stage.name = input.name;
      if (input.ownerIds !== undefined) stage.ownerIds = input.ownerIds;
      if (input.note !== undefined) stage.note = input.note || null;

      if (input.order === undefined) {
        await stageRepository.save(stage);
      } else {
        const siblings = await stageRepository.find({
          where: { requirementId: stage.requirementId },
          order: { order: 'ASC', createdAt: 'ASC' },
        });
        const fromOrder = siblings.findIndex((item) => item.id === stage.id);
        const withoutStage = siblings.filter((item) => item.id !== stage.id);
        const targetOrder = Math.min(
          Math.max(input.order, 0),
          withoutStage.length,
        );
        withoutStage.splice(targetOrder, 0, stage);
        withoutStage.forEach((item, order) => (item.order = order));
        await stageRepository.save(withoutStage);

        if (fromOrder !== targetOrder) {
          await this.recordChange(manager, {
            entityType: 'stage',
            entityId: stage.id,
            projectId: requirement.projectId,
            requirementId: requirement.id,
            type: 'stage_order_changed',
            summary: `${requirement.key} 调整阶段「${stage.name}」顺序`,
            details: { fromOrder, toOrder: targetOrder },
            ...context(input),
          });
        }
      }

      if (
        input.name !== undefined ||
        input.ownerIds !== undefined ||
        input.note !== undefined
      ) {
        await this.recordChange(manager, {
          entityType: 'stage',
          entityId: stage.id,
          projectId: requirement.projectId,
          requirementId: requirement.id,
          type: 'stage_updated',
          summary: `${requirement.key} 更新阶段「${stage.name}」资料`,
          details: {
            before,
            after: {
              name: stage.name,
              ownerIds: stage.ownerIds,
              note: stage.note,
              order: stage.order,
            },
          },
          ...context(input),
        });
      }
    });
    return this.getStage(id);
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

  async deleteStage(id: string, input: DeleteWorkItemDto): Promise<void> {
    const stage = await this.findStage(id);
    this.assertDeleteConfirmation(stage.name, input.confirmation);
    const requirement = await this.findRequirement(stage.requirementId);
    await this.dataSource.transaction(async (manager) => {
      await this.deactivateDependencies(manager, [{ type: 'stage', id }]);
      await this.recordChange(manager, {
        entityType: 'stage',
        entityId: stage.id,
        projectId: requirement.projectId,
        requirementId: requirement.id,
        type: 'stage_deleted',
        summary: `${requirement.key} 删除阶段「${stage.name}」`,
        details: { reason: input.reason },
        ...context(input),
      });
      await manager.getRepository(StageEntity).softDelete(id);
      const siblings = await manager.getRepository(StageEntity).find({
        where: { requirementId: requirement.id },
        order: { order: 'ASC', createdAt: 'ASC' },
      });
      siblings.forEach((item, order) => (item.order = order));
      await manager.save(siblings);
      await this.recomputeRequirement(manager, requirement.id);
    });
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
    if (
      input.title === undefined &&
      input.description === undefined &&
      input.ownerIds === undefined &&
      input.targetVersionId === undefined
    ) {
      return this.getBug(bug.id);
    }
    const requirement = await this.findRequirement(bug.requirementId);
    if (input.targetVersionId) {
      await this.assertVersionInProject(
        this.dataSource.manager,
        input.targetVersionId,
        requirement.projectId,
      );
    }
    const before = {
      title: bug.title,
      description: bug.description,
      ownerIds: [...bug.ownerIds],
      targetVersionId: bug.targetVersionId,
    };
    await this.dataSource.transaction(async (manager) => {
      if (input.title !== undefined) bug.title = input.title;
      if (input.description !== undefined)
        bug.description = input.description || null;
      if (input.ownerIds !== undefined) bug.ownerIds = input.ownerIds;
      if (input.targetVersionId !== undefined)
        bug.targetVersionId = input.targetVersionId || null;
      await manager.save(bug);
      await this.recordChange(manager, {
        entityType: 'bug',
        entityId: bug.id,
        projectId: requirement.projectId,
        requirementId: requirement.id,
        type: 'bug_updated',
        summary: `${bug.key} 更新基本资料`,
        details: {
          before,
          after: {
            title: bug.title,
            description: bug.description,
            ownerIds: bug.ownerIds,
            targetVersionId: bug.targetVersionId,
          },
        },
        ...context(input),
      });
    });
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

  async deleteBug(id: string, input: DeleteWorkItemDto): Promise<void> {
    const bug = await this.findBug(id);
    this.assertDeleteConfirmation(bug.key, input.confirmation);
    const requirement = await this.findRequirement(bug.requirementId);
    await this.dataSource.transaction(async (manager) => {
      await this.deactivateDependencies(manager, [{ type: 'bug', id }]);
      await this.recordChange(manager, {
        entityType: 'bug',
        entityId: bug.id,
        projectId: requirement.projectId,
        requirementId: requirement.id,
        type: 'bug_deleted',
        summary: `${requirement.key} 删除 ${bug.key}「${bug.title}」`,
        details: { reason: input.reason },
        ...context(input),
      });
      await manager.getRepository(BugEntity).softDelete(id);
      await this.recomputeRequirement(manager, requirement.id);
    });
  }

  async correctStatusHistory(
    id: string,
    input: CorrectStatusHistoryDto,
  ): Promise<Stage | Bug> {
    const history = await this.statuses.findOneBy({ id });
    if (!history) throw new NotFoundException('未找到状态历史');
    const before = {
      status: history.toStatus,
      effectiveAt: history.effectiveAt.toISOString(),
      note: history.note,
      statusReason: history.reason,
      expectedResumeAt: iso(history.expectedResumeAt),
    };
    const statusChanged =
      input.status !== undefined && input.status !== history.toStatus;
    if (input.status !== undefined) history.toStatus = input.status;
    if (input.effectiveAt !== undefined)
      history.effectiveAt = new Date(input.effectiveAt);
    if (input.note !== undefined) history.note = input.note || null;
    if (input.statusReason !== undefined)
      history.reason = input.statusReason || null;
    if (input.expectedResumeAt !== undefined)
      history.expectedResumeAt = date(input.expectedResumeAt);
    if (statusChanged && history.toStatus !== 'waiting') {
      if (input.expectedResumeAt === undefined) history.expectedResumeAt = null;
      if (
        history.toStatus !== 'blocked' &&
        (before.status === 'waiting' || before.status === 'blocked') &&
        input.statusReason === undefined
      )
        history.reason = null;
    }
    if (
      (history.toStatus === 'waiting' || history.toStatus === 'blocked') &&
      !history.reason?.trim()
    ) {
      throw new BadRequestException('等待中或阻塞的历史记录必须填写原因');
    }
    const after = {
      status: history.toStatus,
      effectiveAt: history.effectiveAt.toISOString(),
      note: history.note,
      statusReason: history.reason,
      expectedResumeAt: iso(history.expectedResumeAt),
    };
    if (JSON.stringify(before) === JSON.stringify(after)) {
      throw new BadRequestException('这条历史记录没有发生变化');
    }
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
      if (!entity) throw new NotFoundException('未找到历史记录对应的事项');
      const requirement = await manager
        .getRepository(RequirementEntity)
        .findOneBy({ id: entity.requirementId });
      if (!requirement) throw new NotFoundException('未找到历史记录对应的需求');
      await this.recomputeRequirement(manager, entity.requirementId);
      const itemName =
        history.entityType === 'stage'
          ? (entity as StageEntity).name
          : (entity as BugEntity).key;
      await this.recordChange(manager, {
        entityType: history.entityType,
        entityId: history.entityId,
        projectId: requirement.projectId,
        requirementId: requirement.id,
        type: `${history.entityType}_status_history_corrected`,
        summary: `${itemName} 修正历史状态记录`,
        details: { historyId: history.id, before, after },
        ...context(input),
      });
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
    if (!dependency.active) return this.toDependency(dependency);
    const successor = await this.getTargetSummary(
      dependency.successorType,
      dependency.successorId,
    );
    const predecessor = await this.getTargetSummary(
      dependency.predecessorType,
      dependency.predecessorId,
    );
    await this.dataSource.transaction(async (manager) => {
      dependency.active = false;
      dependency.resolvedAt = new Date();
      await manager.save(dependency);
      await this.recordChange(manager, {
        entityType: 'dependency',
        entityId: dependency.id,
        projectId: successor.projectId,
        requirementId: successor.requirementId,
        type: 'dependency_removed',
        summary: `${successor.name} 不再依赖 ${predecessor.projectName} / ${predecessor.name}`,
        details: { successor, predecessor },
        ...context(change),
      });
    });
    return this.toDependency(dependency);
  }

  async getChanges(filters: ChangeFilters): Promise<ChangeEvent[]> {
    const since = new Date(filters.since);
    if (Number.isNaN(since.getTime())) {
      throw new BadRequestException('since 必须是有效的 ISO 8601 时间');
    }
    const base: FindOptionsWhere<ChangeEventEntity> = {
      occurredAt: MoreThanOrEqual(since),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
    };
    let where:
      | FindOptionsWhere<ChangeEventEntity>
      | FindOptionsWhere<ChangeEventEntity>[] = base;
    if (filters.requirementId) {
      where = { ...base, requirementId: filters.requirementId };
    } else if (filters.versionId) {
      const version = await this.versions.findOneBy({ id: filters.versionId });
      if (!version) throw new NotFoundException('未找到版本');
      if (filters.projectId && filters.projectId !== version.projectId) {
        throw new BadRequestException('版本不属于指定项目');
      }
      const requirements = await this.requirements.find({
        where: { versionId: version.id },
        select: { id: true },
      });
      where = [
        { ...base, entityType: 'version', entityId: version.id },
        ...(requirements.length
          ? [
              {
                ...base,
                requirementId: In(requirements.map((item) => item.id)),
              },
            ]
          : []),
      ];
    }
    const rows = await this.changes.find({
      where,
      order: { occurredAt: 'DESC' },
      take: Math.min(Math.max(filters.limit ?? 100, 1), 300),
    });
    return this.hydrateChanges(rows);
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
    const actualStartAt = date(input.actualStartAt);
    const actualEndAt = date(input.actualEndAt);
    if (
      actualStartAt &&
      actualEndAt &&
      actualStartAt.getTime() > actualEndAt.getTime()
    ) {
      throw new BadRequestException('实际结束时间不能早于实际开始时间');
    }
    if (actualEndAt && input.status !== 'done') {
      throw new BadRequestException('只有已完成事项可以填写实际结束时间');
    }
    const ownersChanged =
      input.ownerIds !== undefined &&
      [...input.ownerIds].sort().join('\0') !==
        [...entity.ownerIds].sort().join('\0');
    const requirement = await this.findRequirement(entity.requirementId);
    await this.dataSource.transaction(async (manager) => {
      let historyCreatedAt = await this.nextStatusHistoryCreatedAt(
        manager,
        kind,
        entity.id,
      );
      const takeHistoryCreatedAt = () => {
        const value = historyCreatedAt;
        historyCreatedAt = new Date(historyCreatedAt.getTime() + 1);
        return value;
      };
      const recordsStatus =
        input.status !== entity.status ||
        Boolean(
          input.statusReason?.trim() ||
          input.expectedResumeAt ||
          input.note?.trim(),
        );
      if (actualStartAt && input.status !== 'in_progress') {
        await this.reconcileActualPeriod(
          manager,
          kind,
          entity.id,
          actualStartAt,
          null,
          input,
          takeHistoryCreatedAt(),
        );
      }
      if (recordsStatus) {
        await manager.save(
          manager.getRepository(StatusHistoryEntity).create({
            id: randomUUID(),
            entityType: kind,
            entityId: entity.id,
            fromStatus: null,
            toStatus: input.status,
            effectiveAt:
              date(input.effectiveAt) ??
              (input.status === 'done'
                ? actualEndAt
                : input.status === 'in_progress'
                  ? actualStartAt
                  : null) ??
              new Date(),
            note: input.note ?? null,
            reason: input.statusReason ?? input.reason ?? null,
            expectedResumeAt: date(input.expectedResumeAt),
            source: context(input).source,
            agentName: input.agentName ?? null,
            createdAt: takeHistoryCreatedAt(),
          }),
        );
      }
      if ((actualStartAt && input.status === 'in_progress') || actualEndAt) {
        await this.reconcileActualPeriod(
          manager,
          kind,
          entity.id,
          input.status === 'in_progress' ? actualStartAt : null,
          actualEndAt,
          input,
          takeHistoryCreatedAt(),
        );
      }
      if (recordsStatus || actualStartAt || actualEndAt) {
        await this.recomputeTrackable(manager, kind, entity.id);
      }
      if (ownersChanged && input.ownerIds) {
        const repository = manager.getRepository(
          kind === 'stage' ? StageEntity : BugEntity,
        );
        const current = await repository.findOneBy({ id: entity.id });
        if (current) {
          current.ownerIds = input.ownerIds;
          await repository.save(current);
        }
      }
      await this.recomputeRequirement(manager, requirement.id);
      const name =
        kind === 'stage'
          ? (entity as StageEntity).name
          : (entity as BugEntity).key;
      if (recordsStatus) {
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
            ownerIds: input.ownerIds,
          },
          ...context(input),
        });
      }
      if (actualStartAt || actualEndAt) {
        await this.recordChange(manager, {
          entityType: kind,
          entityId: entity.id,
          projectId: requirement.projectId,
          requirementId: requirement.id,
          type: `${kind}_actual_period_corrected`,
          summary: `${name} 补录实际起止时间`,
          details: {
            actualStartAt: iso(actualStartAt),
            actualEndAt: iso(actualEndAt),
          },
          ...context(input),
        });
      }
      if (ownersChanged && input.ownerIds) {
        await this.recordChange(manager, {
          entityType: kind,
          entityId: entity.id,
          projectId: requirement.projectId,
          requirementId: requirement.id,
          type: `${kind}_updated`,
          summary: `${name} 更新负责人`,
          details: {
            before: { ownerIds: entity.ownerIds },
            after: { ownerIds: input.ownerIds },
          },
          ...context(input),
        });
      }
    });
  }

  private async reconcileActualPeriod(
    manager: EntityManager,
    kind: 'stage' | 'bug',
    entityId: string,
    actualStartAt: Date | null,
    actualEndAt: Date | null,
    input: UpdateStatusDto,
    createdAt: Date,
  ): Promise<void> {
    const repository = manager.getRepository(StatusHistoryEntity);
    const history = await repository.find({
      where: { entityType: kind, entityId },
      order: { effectiveAt: 'ASC', createdAt: 'ASC' },
    });
    if (actualStartAt) {
      const started = history.find((item) => item.toStatus === 'in_progress');
      if (started) started.effectiveAt = actualStartAt;
      else {
        history.push(
          repository.create({
            id: randomUUID(),
            entityType: kind,
            entityId,
            fromStatus: null,
            toStatus: 'in_progress',
            effectiveAt: actualStartAt,
            note: '补录实际开始时间',
            reason: null,
            expectedResumeAt: null,
            source: context(input).source,
            agentName: input.agentName ?? null,
            createdAt,
          }),
        );
      }
    }
    if (actualEndAt) {
      const completed = [...history]
        .reverse()
        .find((item) => item.toStatus === 'done');
      if (completed) completed.effectiveAt = actualEndAt;
      else {
        history.push(
          repository.create({
            id: randomUUID(),
            entityType: kind,
            entityId,
            fromStatus: null,
            toStatus: 'done',
            effectiveAt: actualEndAt,
            note: '补录实际结束时间',
            reason: null,
            expectedResumeAt: null,
            source: context(input).source,
            agentName: input.agentName ?? null,
            createdAt,
          }),
        );
      }
    }
    await repository.save(history);
  }

  private async nextStatusHistoryCreatedAt(
    manager: EntityManager,
    kind: 'stage' | 'bug',
    entityId: string,
  ): Promise<Date> {
    const latest = await manager.getRepository(StatusHistoryEntity).findOne({
      where: { entityType: kind, entityId },
      order: { createdAt: 'DESC' },
    });
    return new Date(
      Math.max(Date.now(), (latest?.createdAt.getTime() ?? 0) + 1),
    );
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
    const history = this.orderStatusHistory(
      await manager.getRepository(StatusHistoryEntity).find({
        where: { entityType: kind, entityId },
        order: { effectiveAt: 'ASC', createdAt: 'ASC' },
      }),
    );
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

  private assertDeleteConfirmation(expected: string, actual: string): void {
    if (actual.trim() !== expected) {
      throw new BadRequestException(`请输入「${expected}」确认删除`);
    }
  }

  private async deactivateDependencies(
    manager: EntityManager,
    targets: Array<{ type: DependencyTargetType; id: string }>,
  ): Promise<void> {
    const keys = new Set(targets.map((item) => `${item.type}:${item.id}`));
    const repository = manager.getRepository(DependencyEntity);
    const dependencies = await repository.findBy({ active: true });
    const affected = dependencies.filter(
      (item) =>
        keys.has(`${item.successorType}:${item.successorId}`) ||
        keys.has(`${item.predecessorType}:${item.predecessorId}`),
    );
    const resolvedAt = new Date();
    for (const dependency of affected) {
      dependency.active = false;
      dependency.resolvedAt = resolvedAt;
    }
    await repository.save(affected);
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
    const current = selectCurrentStage(requirement.stages);
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
      currentStageId: current?.id,
      currentStageStatus: current?.status,
      currentStageOwnerIds: current?.ownerIds ?? [],
      currentStagePlannedStartAt: current?.plannedStartAt,
      currentStagePlannedEndAt: current?.plannedEndAt,
      activeStages: selectActiveStages(requirement.stages).map((stage) =>
        this.toRequirementStageSummary(stage),
      ),
      nextStages: selectNextStages(requirement.stages).map((stage) =>
        this.toRequirementStageSummary(stage),
      ),
      reviewIssues: reviewRequirement(requirement),
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
    const allWork = full.flatMap((requirement) =>
      [...requirement.stages, ...requirement.bugs].map((item) => ({
        item,
        requirement,
      })),
    );
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
      reviewItems: requirements.flatMap((requirement) =>
        requirement.reviewIssues.map((issue) => ({
          ...issue,
          requirementId: requirement.id,
          requirementKey: requirement.key,
          requirementTitle: requirement.title,
        })),
      ),
      waitingItems: allWork
        .filter(({ item }) => item.status === 'waiting')
        .map(({ item, requirement }) =>
          this.toSnapshotWorkItem(item, requirement),
        ),
      blockedItems: allWork
        .filter(({ item }) => item.status === 'blocked')
        .map(({ item, requirement }) =>
          this.toSnapshotWorkItem(item, requirement),
        ),
      delayedItems: requirements.filter((item) => item.overdue),
      openBugs: full.flatMap((requirement) =>
        requirement.bugs
          .filter((bug) => !['done', 'canceled'].includes(bug.status))
          .map((bug) => this.toSnapshotWorkItem(bug, requirement)),
      ),
      externalDependencies,
      recentChanges: await this.hydrateChanges(recentChanges),
      generatedAt: new Date().toISOString(),
    };
  }

  private toSnapshotWorkItem(
    item: Stage | Bug,
    requirement: Requirement,
  ): SnapshotWorkItem {
    const isBug = 'key' in item;
    return {
      type: isBug ? 'bug' : 'stage',
      id: item.id,
      key: isBug ? item.key : undefined,
      name: isBug ? item.title : item.name,
      status: item.status,
      reason: item.statusReason,
      expectedResumeAt: item.expectedResumeAt,
      ownerIds: item.ownerIds,
      requirementId: requirement.id,
      requirementKey: requirement.key,
      requirementTitle: requirement.title,
      baselineStartAt: item.baselineStartAt,
      baselineEndAt: item.baselineEndAt,
      plannedStartAt: item.plannedStartAt,
      plannedEndAt: item.plannedEndAt,
      actualStartAt: item.actualStartAt,
      actualEndAt: item.actualEndAt,
    };
  }

  private toRequirementStageSummary(stage: Stage): RequirementStageSummary {
    return {
      id: stage.id,
      name: stage.name,
      order: stage.order,
      ownerIds: stage.ownerIds,
      status: stage.status,
      note: stage.note,
      statusReason: stage.statusReason,
      expectedResumeAt: stage.expectedResumeAt,
      baselineStartAt: stage.baselineStartAt,
      baselineEndAt: stage.baselineEndAt,
      plannedStartAt: stage.plannedStartAt,
      plannedEndAt: stage.plannedEndAt,
      actualStartAt: stage.actualStartAt,
      actualEndAt: stage.actualEndAt,
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
      sortOrder: row.sortOrder,
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
      statusHistory: this.orderStatusHistory(statusHistory).map((item) =>
        this.toStatusHistory(item),
      ),
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
      statusHistory: this.orderStatusHistory(statusHistory).map((item) =>
        this.toStatusHistory(item),
      ),
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

  private orderStatusHistory(
    rows: StatusHistoryEntity[],
  ): StatusHistoryEntity[] {
    const inferredStart = (item: StatusHistoryEntity) =>
      item.toStatus === 'in_progress' && item.note === '补录实际开始时间'
        ? -1
        : 0;
    const terminal = (status: ExecutionStatus) =>
      status === 'done' || status === 'canceled' ? 1 : 0;
    return [...rows].sort((left, right) => {
      const effective =
        left.effectiveAt.getTime() - right.effectiveAt.getTime();
      if (effective) return effective;
      const inferredOrder = inferredStart(left) - inferredStart(right);
      if (inferredOrder) return inferredOrder;
      const terminalOrder = terminal(left.toStatus) - terminal(right.toStatus);
      if (terminalOrder) return terminalOrder;
      const created = left.createdAt.getTime() - right.createdAt.getTime();
      return created || left.id.localeCompare(right.id);
    });
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
      effectiveAt: (row.effectiveAt ?? row.changedAt).toISOString(),
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

  private async hydrateChanges(
    rows: ChangeEventEntity[],
  ): Promise<ChangeEvent[]> {
    const requirementIds = [
      ...new Set(
        rows
          .map((item) => item.requirementId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const requirements = requirementIds.length
      ? await this.requirements.findBy({ id: In(requirementIds) })
      : [];
    const requirementMap = new Map(requirements.map((item) => [item.id, item]));
    const projectIds = [
      ...new Set(
        [
          ...rows.map((item) => item.projectId),
          ...requirements.map((item) => item.projectId),
        ].filter((id): id is string => Boolean(id)),
      ),
    ];
    const versionIds = [
      ...new Set(
        [
          ...rows
            .filter((item) => item.entityType === 'version')
            .map((item) => item.entityId),
          ...requirements.map((item) => item.versionId),
        ].filter((id): id is string => Boolean(id)),
      ),
    ];
    const [projects, versions] = await Promise.all([
      projectIds.length ? this.projects.findBy({ id: In(projectIds) }) : [],
      versionIds.length ? this.versions.findBy({ id: In(versionIds) }) : [],
    ]);
    const projectMap = new Map(projects.map((item) => [item.id, item]));
    const versionMap = new Map(versions.map((item) => [item.id, item]));

    return rows.map((row) => {
      const requirement = row.requirementId
        ? requirementMap.get(row.requirementId)
        : undefined;
      const project = row.projectId
        ? projectMap.get(row.projectId)
        : requirement
          ? projectMap.get(requirement.projectId)
          : undefined;
      const version =
        row.entityType === 'version'
          ? versionMap.get(row.entityId)
          : requirement?.versionId
            ? versionMap.get(requirement.versionId)
            : undefined;
      return {
        ...this.toChange(row),
        project: project
          ? { id: project.id, key: project.key, name: project.name }
          : undefined,
        version: version ? { id: version.id, name: version.name } : undefined,
        requirement: requirement
          ? {
              id: requirement.id,
              key: requirement.key,
              title: requirement.title,
            }
          : undefined,
      };
    });
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
      reason: row.reason ?? undefined,
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
      dependsOnTemplateStageIds?: string[];
    }>,
  ): TemplateStage[] {
    const ids = stages.map((stage) => stage.id ?? randomUUID());
    return stages.map((stage, order) => ({
      id: ids[order] as string,
      name: stage.name,
      order,
      ownerIds: [],
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
      reason?: string;
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
        reason: input.reason ?? null,
        source: input.source,
        agentName: input.agentName ?? null,
        occurredAt: new Date(),
      }),
    );
  }
}

export const workEntities = entities;
