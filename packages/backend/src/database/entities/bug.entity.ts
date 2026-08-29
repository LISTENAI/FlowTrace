import type { ExecutionStatus } from '@flowtrace/shared';
import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/database/entities/base';

@Entity('bugs')
export class BugEntity extends BaseEntity {
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Index({ unique: true })
  @Column('text')
  key!: string;

  @Index()
  @Column('uuid')
  requirementId!: string;

  @Column('text')
  title!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  @Column('jsonb', { default: () => "'[]'::jsonb" })
  ownerIds!: string[];

  @Column('text', { default: 'not_started' })
  status!: ExecutionStatus;

  @Column('text', { nullable: true })
  statusReason!: string | null;

  @Column('timestamptz', { nullable: true })
  expectedResumeAt!: Date | null;

  @Column('uuid', { nullable: true })
  discoveredStageId!: string | null;

  @Column('uuid', { nullable: true })
  discoveredVersionId!: string | null;

  @Column('uuid', { nullable: true })
  targetVersionId!: string | null;

  @Column('timestamptz', { nullable: true })
  baselineStartAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  baselineEndAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  plannedStartAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  plannedEndAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  actualStartAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  actualEndAt!: Date | null;
}
