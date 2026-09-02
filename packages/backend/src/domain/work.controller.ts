import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  searchEntityTypes,
  type ChangeContext,
  type SearchEntityType,
} from '@flowtrace/shared';
import {
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
  UpdateProjectAgentHandoffDto,
  UpdateProjectRhythmDto,
  UpdateRequirementDto,
  UpdateStageDto,
  UpdateStatusDto,
  UpdateTemplateDto,
  UpdateVersionDto,
} from '@/domain/dto';
import { WorkService } from '@/domain/work.service';
import { PublicAuth } from '@/auth/auth-public';
import type { AuthenticatedRequest } from '@/auth/auth-session';

const uuidPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException('ID 格式无效，请使用完整的 UUID'),
});

const optionalUuidPipe = new ParseUUIDPipe({
  optional: true,
  exceptionFactory: () =>
    new BadRequestException('ID 格式无效，请使用完整的 UUID'),
});

@ApiTags('项目')
@Controller('projects')
export class ProjectsController {
  constructor(@Inject(WorkService) private readonly work: WorkService) {}

  @Get()
  @ApiOperation({ summary: '列出所有项目及健康指标' })
  list() {
    return this.work.listProjects();
  }

  @Post()
  @ApiOperation({ summary: '创建项目' })
  create(@Body() input: CreateProjectDto) {
    return this.work.createProject(input);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.work.getProject(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateProjectDto) {
    return this.work.updateProject(id, input);
  }

  @Get(':id/agent-handoff')
  @ApiOperation({ summary: '读取供不同 Agent 会话接手项目使用的交底' })
  getAgentHandoff(@Param('id') id: string) {
    return this.work.getProjectAgentHandoff(id);
  }

  @Put(':id/agent-handoff')
  @ApiOperation({ summary: '保存 Agent 交底并创建不可变修订历史' })
  updateAgentHandoff(
    @Param('id') id: string,
    @Body() input: UpdateProjectAgentHandoffDto,
  ) {
    return this.work.updateProjectAgentHandoff(id, input);
  }

  @Get(':id/agent-handoff/history')
  @ApiOperation({ summary: '列出 Agent 交底修订历史' })
  getAgentHandoffHistory(@Param('id') id: string) {
    return this.work.listProjectAgentHandoffHistory(id);
  }

  @Put(':id/template')
  @ApiOperation({ summary: '更新阶段模板，仅影响之后创建的需求' })
  updateTemplate(@Param('id') id: string, @Body() input: UpdateTemplateDto) {
    return this.work.updateTemplate(id, input);
  }

  @Get(':id/versions')
  versions(@Param('id') id: string) {
    return this.work.listVersions(id);
  }

  @Post(':id/versions')
  createVersion(@Param('id') id: string, @Body() input: CreateVersionDto) {
    return this.work.createVersion(id, input);
  }
}

@ApiTags('项目节奏')
@Controller('project-rhythms')
export class ProjectRhythmsController {
  constructor(@Inject(WorkService) private readonly work: WorkService) {}

  @Get()
  @ApiOperation({ summary: '列出创建项目时可选的节奏' })
  list() {
    return this.work.listProjectRhythms();
  }

  @Post()
  create(@Body() input: CreateProjectRhythmDto) {
    return this.work.createProjectRhythm(input);
  }

  @Patch(':id')
  update(
    @Param('id', uuidPipe) id: string,
    @Body() input: UpdateProjectRhythmDto,
  ) {
    return this.work.updateProjectRhythm(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', uuidPipe) id: string) {
    return this.work.deleteProjectRhythm(id);
  }
}

@ApiTags('版本')
@Controller('versions')
export class VersionsController {
  constructor(@Inject(WorkService) private readonly work: WorkService) {}

  @Patch(':id')
  update(@Param('id', uuidPipe) id: string, @Body() input: UpdateVersionDto) {
    return this.work.updateVersion(id, input);
  }
}

@ApiTags('人员')
@Controller('people')
export class PeopleController {
  constructor(@Inject(WorkService) private readonly work: WorkService) {}

  @Get()
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  list(
    @Query('includeInactive', new ParseBoolPipe({ optional: true }))
    includeInactive?: boolean,
  ) {
    return this.work.listPeople(includeInactive);
  }

  @Post()
  create(@Body() input: CreatePersonDto) {
    return this.work.createPerson(input);
  }

  @Patch(':id')
  update(
    @Param('id', uuidPipe) id: string,
    @Body() input: UpdatePersonDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.work.updatePerson(
      id,
      input,
      request.flowTraceIdentity?.person.id,
    );
  }
}

@ApiTags('需求')
@Controller('requirements')
export class RequirementsController {
  constructor(@Inject(WorkService) private readonly work: WorkService) {}

  @Get()
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'versionId', required: false })
  @ApiQuery({ name: 'ownerId', required: false })
  @ApiQuery({ name: 'lifecycle', required: false })
  @ApiQuery({ name: 'health', required: false })
  @ApiQuery({ name: 'overdue', required: false, type: Boolean })
  list(
    @Query('projectId', optionalUuidPipe) projectId?: string,
    @Query('versionId', optionalUuidPipe) versionId?: string,
    @Query('ownerId', optionalUuidPipe) ownerId?: string,
    @Query('lifecycle')
    lifecycle?: 'not_started' | 'in_progress' | 'done' | 'canceled',
    @Query('health') health?: 'normal' | 'waiting' | 'blocked',
    @Query('overdue', new ParseBoolPipe({ optional: true })) overdue?: boolean,
  ) {
    return this.work.listRequirements({
      projectId,
      versionId,
      ownerId,
      lifecycle,
      health,
      overdue,
    });
  }

  @Post()
  @ApiOperation({ summary: '创建需求，可复制项目模板或直接提供真实阶段' })
  create(@Body() input: CreateRequirementDto) {
    return this.work.createRequirement(input);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.work.getRequirement(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateRequirementDto) {
    return this.work.updateRequirement(id, input);
  }

  @Post(':id/move-version')
  @ApiOperation({ summary: '移动目标版本并保留迁移历史' })
  moveVersion(@Param('id') id: string, @Body() input: MoveVersionDto) {
    return this.work.moveRequirement(id, input);
  }

  @Post(':id/reschedule')
  reschedule(@Param('id') id: string, @Body() input: RescheduleDto) {
    return this.work.rescheduleRequirement(id, input);
  }

  @Post(':id/stages')
  addStage(@Param('id') id: string, @Body() input: CreateStageDto) {
    return this.work.addStage(id, input);
  }

  @Post(':id/bugs')
  reportBug(@Param('id') id: string, @Body() input: CreateBugDto) {
    return this.work.reportBug(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '软删除需求及其事项，并保留审计历史' })
  remove(@Param('id') id: string, @Body() input: DeleteWorkItemDto) {
    return this.work.deleteRequirement(id, input);
  }
}

@ApiTags('阶段')
@Controller('stages')
export class StagesController {
  constructor(@Inject(WorkService) private readonly work: WorkService) {}

  @Patch(':id')
  update(@Param('id', uuidPipe) id: string, @Body() input: UpdateStageDto) {
    return this.work.updateStage(id, input);
  }

  @Post(':id/status')
  @ApiOperation({ summary: '更新阶段状态，支持补录生效时间' })
  status(@Param('id', uuidPipe) id: string, @Body() input: UpdateStatusDto) {
    return this.work.updateStageStatus(id, input);
  }

  @Post(':id/reschedule')
  @ApiOperation({ summary: '调整排期并保留基准和变更历史' })
  reschedule(@Param('id', uuidPipe) id: string, @Body() input: RescheduleDto) {
    return this.work.rescheduleStage(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '软删除阶段，并保留状态和排期历史' })
  remove(@Param('id', uuidPipe) id: string, @Body() input: DeleteWorkItemDto) {
    return this.work.deleteStage(id, input);
  }
}

@ApiTags('Bug')
@Controller('bugs')
export class BugsController {
  constructor(@Inject(WorkService) private readonly work: WorkService) {}

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateBugDto) {
    return this.work.updateBug(id, input);
  }

  @Post(':id/status')
  @ApiOperation({ summary: '更新 Bug 状态，支持补录生效时间' })
  status(@Param('id') id: string, @Body() input: UpdateStatusDto) {
    return this.work.updateBugStatus(id, input);
  }

  @Post(':id/reschedule')
  reschedule(@Param('id') id: string, @Body() input: RescheduleDto) {
    return this.work.rescheduleBug(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '软删除 Bug，并保留状态和排期历史' })
  remove(@Param('id') id: string, @Body() input: DeleteWorkItemDto) {
    return this.work.deleteBug(id, input);
  }
}

@ApiTags('依赖')
@Controller('dependencies')
export class DependenciesController {
  constructor(@Inject(WorkService) private readonly work: WorkService) {}

  @Get()
  list(@Query('requirementId', optionalUuidPipe) requirementId?: string) {
    return this.work.listDependencies(requirementId);
  }

  @Post()
  @ApiOperation({ summary: '建立事项依赖；未满足时只提示，不阻止推进' })
  create(@Body() input: CreateDependencyDto) {
    return this.work.addDependency(input);
  }

  @Post(':id/resolve')
  resolve(@Param('id', uuidPipe) id: string, @Body() input: ChangeContext) {
    return this.work.resolveDependency(id, input);
  }
}

@ApiTags('快照与变化')
@Controller()
export class InsightsController {
  constructor(@Inject(WorkService) private readonly work: WorkService) {}

  @Get('health')
  @PublicAuth()
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }

  @Get('snapshots/projects/:id')
  project(@Param('id') id: string) {
    return this.work.getProjectSnapshot(id);
  }

  @Get('snapshots/versions/:id')
  version(@Param('id', uuidPipe) id: string) {
    return this.work.getVersionSnapshot(id);
  }

  @Get('snapshots/requirements/:id')
  requirement(@Param('id') id: string) {
    return this.work.getRequirementDetail(id);
  }

  @Get('search')
  @ApiOperation({ summary: '跨项目搜索可被 Agent 稳定引用的业务对象' })
  @ApiQuery({
    name: 'includeInactivePeople',
    required: false,
    type: Boolean,
  })
  search(
    @Query('q') query?: string,
    @Query('types') types?: string,
    @Query('limit') limit?: string,
    @Query('includeInactivePeople', new ParseBoolPipe({ optional: true }))
    includeInactivePeople?: boolean,
  ) {
    const selected = types
      ? types.split(',').filter(Boolean)
      : [...searchEntityTypes];
    const invalid = selected.filter(
      (item) => !searchEntityTypes.includes(item as SearchEntityType),
    );
    if (invalid.length) {
      throw new BadRequestException(`不支持的搜索类型：${invalid.join(', ')}`);
    }
    const parsedLimit = limit === undefined ? 20 : Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      throw new BadRequestException('limit 必须是正整数');
    }
    return this.work.search(
      query ?? '',
      selected as SearchEntityType[],
      parsedLimit,
      includeInactivePeople,
    );
  }

  @Get('changes')
  @ApiOperation({ summary: '获取指定时间之后的结构化增量变化' })
  changes(
    @Query('since') since: string,
    @Query('projectId', optionalUuidPipe) projectId?: string,
    @Query('versionId', optionalUuidPipe) versionId?: string,
    @Query('requirementId', optionalUuidPipe) requirementId?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit === undefined ? undefined : Number(limit);
    if (
      parsedLimit !== undefined &&
      (!Number.isInteger(parsedLimit) || parsedLimit < 1)
    ) {
      throw new BadRequestException('limit 必须是正整数');
    }
    return this.work.getChanges({
      since,
      projectId,
      versionId,
      requirementId,
      limit: parsedLimit,
    });
  }

  @Post('batch')
  @ApiOperation({ summary: '批量执行常见 Agent 操作，逐项返回结果' })
  batch(@Body() input: BatchDto) {
    return this.work.batch(input);
  }
}

@ApiTags('历史')
@Controller('history')
export class HistoryController {
  constructor(@Inject(WorkService) private readonly work: WorkService) {}

  @Patch('status/:id')
  @ApiOperation({ summary: '修正状态、原因或生效时间并重算实际时间' })
  correctStatus(
    @Param('id', uuidPipe) id: string,
    @Body() input: CorrectStatusHistoryDto,
  ) {
    return this.work.correctStatusHistory(id, input);
  }
}
