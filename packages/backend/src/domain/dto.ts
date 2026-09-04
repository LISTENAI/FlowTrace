import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  executionStatuses,
  stageWorkDomains,
  type ChangeSource,
  type DependencyTargetType,
  type ExecutionStatus,
  type StageWorkDomain,
  type VersionStatus,
} from '@flowtrace/shared';

export class ChangeContextDto {
  @ApiPropertyOptional({ enum: ['manual', 'api', 'agent'], default: 'manual' })
  @IsOptional()
  @IsIn(['manual', 'api', 'agent'])
  source?: ChangeSource;

  @ApiPropertyOptional({ example: '项目助理' })
  @IsOptional()
  @IsString()
  agentName?: string;

  @ApiPropertyOptional({ example: 'openai/gpt-5.6-sol' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  agentModel?: string;

  @ApiPropertyOptional({ example: '根据项目例会结论调整' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class DeleteWorkItemDto extends ChangeContextDto {
  @ApiProperty({ description: '必须与事项编号或名称完全一致' })
  @IsString()
  @IsNotEmpty()
  confirmation!: string;

  @ApiProperty({ description: '删除原因会保留在审计记录中' })
  @IsString()
  @IsNotEmpty()
  declare reason: string;
}

export class CreatePersonDto {
  @ApiProperty({ example: '张三' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdatePersonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class TemplateStageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: '开发' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ enum: stageWorkDomains })
  @IsOptional()
  @IsIn(stageWorkDomains)
  workDomain?: StageWorkDomain;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  dependsOnTemplateStageIds?: string[];
}

export class CreateProjectRhythmDto {
  @ApiProperty({ example: '软件研发' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ type: [TemplateStageDto] })
  @IsArray()
  stages!: TemplateStageDto[];
}

export class UpdateProjectRhythmDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ type: [TemplateStageDto] })
  @IsOptional()
  @IsArray()
  stages?: TemplateStageDto[];
}

export class CreateProjectDto extends ChangeContextDto {
  @ApiProperty({ example: 'FW' })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9]{1,9}$/)
  key!: string;

  @ApiProperty({ example: '晴岚设备固件' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [TemplateStageDto] })
  @IsOptional()
  @IsArray()
  templateStages?: TemplateStageDto[];
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateProjectAgentHandoffDto extends ChangeContextDto {
  @ApiProperty({ description: '完整的最新交底内容，使用 Markdown 编写' })
  @IsString()
  @MaxLength(30_000)
  content!: string;

  @ApiProperty({ description: '客户端读取到的修订号；首次保存为 0' })
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}

export class UpdateTemplateDto extends ChangeContextDto {
  @ApiProperty({ type: [TemplateStageDto] })
  @IsArray()
  stages!: TemplateStageDto[];
}

export class CreateVersionDto extends ChangeContextDto {
  @ApiProperty({ example: '2.8' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ enum: ['planning', 'active', 'released', 'canceled'] })
  @IsOptional()
  @IsIn(['planning', 'active', 'released', 'canceled'])
  status?: VersionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  plannedStartAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  plannedReleaseAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateVersionDto extends ChangeContextDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ['planning', 'active', 'released', 'canceled'] })
  @IsOptional()
  @IsIn(['planning', 'active', 'released', 'canceled'])
  status?: VersionStatus;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsISO8601()
  plannedStartAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsISO8601()
  plannedReleaseAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsISO8601()
  actualReleaseAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateRequirementStageDto {
  @ApiPropertyOptional({
    description: '来源项目模板阶段；提供时保留仍然有效的模板依赖',
  })
  @IsOptional()
  @IsUUID()
  templateStageId?: string;

  @ApiProperty({ example: '板上验证' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ enum: stageWorkDomains })
  @IsOptional()
  @IsIn(stageWorkDomains)
  workDomain?: StageWorkDomain;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  ownerIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  plannedStartAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  plannedEndAt?: string;
}

export class CreateRequirementDto extends ChangeContextDto {
  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  versionId?: string;

  @ApiProperty({ example: '优化蓝牙配网稳定性' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  ownerIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  plannedStartAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  plannedEndAt?: string;

  @ApiPropertyOptional({
    type: [CreateRequirementStageDto],
    description: '提供时按数组顺序创建这些真实阶段；省略时复制项目模板',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRequirementStageDto)
  stages?: CreateRequirementStageDto[];
}

export class UpdateRequirementDto extends ChangeContextDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  ownerIds?: string[];

  @ApiPropertyOptional({
    enum: ['not_started', 'in_progress', 'done', 'canceled'],
  })
  @IsOptional()
  @IsIn(['not_started', 'in_progress', 'done', 'canceled'])
  lifecycle?: 'not_started' | 'in_progress' | 'done' | 'canceled';
}

export class MoveVersionDto extends ChangeContextDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  versionId?: string | null;

  @ApiPropertyOptional({ description: '版本迁移实际生效时间，允许补录' })
  @IsOptional()
  @IsISO8601()
  effectiveAt?: string;
}

export class CreateStageDto extends ChangeContextDto {
  @ApiProperty({ example: '回归验证' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ enum: stageWorkDomains })
  @IsOptional()
  @IsIn(stageWorkDomains)
  workDomain?: StageWorkDomain;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  ownerIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  plannedStartAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  plannedEndAt?: string;
}

export class UpdateStageDto extends ChangeContextDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: stageWorkDomains })
  @IsOptional()
  @IsIn(stageWorkDomains)
  workDomain?: StageWorkDomain;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  ownerIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateStatusDto extends ChangeContextDto {
  @ApiProperty({ enum: executionStatuses })
  @IsIn(executionStatuses)
  status!: ExecutionStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  ownerIds?: string[];

  @ApiPropertyOptional({ description: '状态实际生效时间，允许补录' })
  @IsOptional()
  @IsISO8601()
  effectiveAt?: string;

  @ApiPropertyOptional({ description: '阶段或 Bug 的实际开始时间，允许补录' })
  @IsOptional()
  @IsISO8601()
  actualStartAt?: string;

  @ApiPropertyOptional({ description: '阶段或 Bug 的实际结束时间，允许补录' })
  @IsOptional()
  @IsISO8601()
  actualEndAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: '进入等待中或阻塞时的原因' })
  @IsOptional()
  @IsString()
  statusReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expectedResumeAt?: string;
}

export class SupersedeStageDto extends ChangeContextDto {
  @ApiProperty({ description: '接替旧阶段的新阶段稳定 UUID' })
  @IsUUID()
  replacementStageId!: string;

  @ApiPropertyOptional({ description: '接替关系实际生效时间，允许补录' })
  @IsOptional()
  @IsISO8601()
  effectiveAt?: string;

  @ApiProperty({ description: '说明为何由新阶段接替旧阶段' })
  @IsString()
  @IsNotEmpty()
  declare reason: string;
}

export class CorrectStatusHistoryDto extends ChangeContextDto {
  @ApiProperty({ description: '说明为什么需要修正这条历史记录' })
  @IsString()
  @IsNotEmpty()
  declare reason: string;

  @ApiPropertyOptional({ enum: executionStatuses })
  @IsOptional()
  @IsIn(executionStatuses)
  status?: ExecutionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  effectiveAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  statusReason?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsISO8601()
  expectedResumeAt?: string | null;
}

export class RescheduleDto extends ChangeContextDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsISO8601()
  plannedStartAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsISO8601()
  plannedEndAt?: string | null;
}

export class CreateBugDto extends ChangeContextDto {
  @ApiProperty({ example: '二次配网可能失败' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  ownerIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  discoveredStageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  discoveredVersionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetVersionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  plannedStartAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  plannedEndAt?: string;
}

export class UpdateBugDto extends ChangeContextDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  ownerIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetVersionId?: string;
}

export class CreateActionItemDto extends ChangeContextDto {
  @ApiProperty({ example: '联系运维开通测试环境' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requirementId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  ownerIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  plannedStartAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  plannedEndAt?: string;
}

export class UpdateActionItemDto extends ChangeContextDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  requirementId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  ownerIds?: string[];
}

export class CreateDependencyDto extends ChangeContextDto {
  @ApiProperty({ enum: ['requirement', 'stage', 'bug'] })
  @IsIn(['requirement', 'stage', 'bug'])
  successorType!: DependencyTargetType;

  @ApiProperty()
  @IsUUID()
  successorId!: string;

  @ApiProperty({ enum: ['requirement', 'stage', 'bug'] })
  @IsIn(['requirement', 'stage', 'bug'])
  predecessorType!: DependencyTargetType;

  @ApiProperty()
  @IsUUID()
  predecessorId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class BatchOperationDto {
  @ApiProperty({
    enum: [
      'update_stage_status',
      'update_bug_status',
      'move_requirement',
      'reschedule_stage',
      'create_bug',
    ],
  })
  @IsString()
  type!: string;

  @ApiProperty()
  @IsUUID()
  targetId!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  payload!: Record<string, unknown>;
}

export class BatchDto extends ChangeContextDto {
  @ApiProperty({ type: [BatchOperationDto] })
  @IsArray()
  operations!: BatchOperationDto[];
}

export const changeSetOperationTypes = [
  'update_requirement',
  'add_stage',
  'update_stage',
  'update_stage_status',
  'reschedule_stage',
  'supersede_stage',
  'add_dependency',
  'remove_dependency',
  'update_project_handoff',
] as const;

export type ChangeSetOperationType = (typeof changeSetOperationTypes)[number];

export class PlannedDependencyDto extends ChangeContextDto {
  @ApiProperty({ enum: ['requirement', 'stage', 'bug'] })
  @IsIn(['requirement', 'stage', 'bug'])
  successorType!: DependencyTargetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  successorId?: string;

  @ApiPropertyOptional({ description: '引用计划内先前操作产生的事项' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{0,63}$/)
  successorOperationId?: string;

  @ApiProperty({ enum: ['requirement', 'stage', 'bug'] })
  @IsIn(['requirement', 'stage', 'bug'])
  predecessorType!: DependencyTargetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  predecessorId?: string;

  @ApiPropertyOptional({ description: '引用计划内先前操作产生的事项' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{0,63}$/)
  predecessorOperationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class PlannedStageSupersessionDto extends ChangeContextDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  replacementStageId?: string;

  @ApiPropertyOptional({ description: '引用计划内先前新增的接替阶段' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{0,63}$/)
  replacementOperationId?: string;

  @ApiPropertyOptional({ description: '接替关系实际生效时间，允许补录' })
  @IsOptional()
  @IsISO8601()
  effectiveAt?: string;
}

export class ChangeSetOperationDto {
  @ApiProperty({
    description: '计划内稳定引用；后续操作可通过 targetOperationId 引用结果',
    example: 'add-production-stage',
  })
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{0,63}$/)
  operationId!: string;

  @ApiProperty({ enum: changeSetOperationTypes })
  @IsIn(changeSetOperationTypes)
  type!: ChangeSetOperationType;

  @ApiPropertyOptional({ description: '已有目标的稳定 UUID' })
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional({
    description: '引用本计划中位于当前操作之前的操作结果',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{0,63}$/)
  targetOperationId?: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  payload!: Record<string, unknown>;
}

export class PreviewChangesDto extends ChangeContextDto {
  @ApiProperty({ description: '本次变更所属的项目稳定 UUID' })
  @IsUUID()
  projectId!: string;

  @ApiProperty({
    description: '整组变更的业务原因，将作为各项操作的默认原因',
  })
  @IsString()
  @IsNotEmpty()
  declare reason: string;

  @ApiProperty({ type: [ChangeSetOperationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ChangeSetOperationDto)
  operations!: ChangeSetOperationDto[];
}

export class ApplyChangesDto extends PreviewChangesDto {
  @ApiProperty({
    description: 'preview_changes 返回的确认令牌；计划或项目状态变化后失效',
  })
  @IsString()
  @IsNotEmpty()
  confirmationToken!: string;
}
