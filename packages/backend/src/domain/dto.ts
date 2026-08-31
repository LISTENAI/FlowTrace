import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
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
