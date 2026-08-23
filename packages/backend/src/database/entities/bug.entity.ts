import type { ExecutionStatus } from '@flowtrace/shared';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/database/entities/base';

@Entity('bugs')
export class BugEntity extends BaseEntity {
  @Index({ unique: true })
  @Column('text')
  key!: string;

  @Index()
  @Column('text')
  requirementId!: string;

  @Column('text')
  title!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  @Column('simple-json', { default: '[]' })
  ownerIds!: string[];

  @Column('text', { default: 'not_started' })
  status!: ExecutionStatus;

  @Column('text', { nullable: true })
  statusReason!: string | null;

  @Column('datetime', { nullable: true })
  expectedResumeAt!: Date | null;

  @Column('text', { nullable: true })
  discoveredStageId!: string | null;

  @Column('text', { nullable: true })
  discoveredVersionId!: string | null;

  @Column('text', { nullable: true })
  targetVersionId!: string | null;

  @Column('datetime', { nullable: true })
  baselineStartAt!: Date | null;

  @Column('datetime', { nullable: true })
  baselineEndAt!: Date | null;

  @Column('datetime', { nullable: true })
  plannedStartAt!: Date | null;

  @Column('datetime', { nullable: true })
  plannedEndAt!: Date | null;

  @Column('datetime', { nullable: true })
  actualStartAt!: Date | null;

  @Column('datetime', { nullable: true })
  actualEndAt!: Date | null;
}
