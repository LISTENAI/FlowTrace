import type { ExecutionStatus, StageWorkDomain } from '@flowtrace/shared';
import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/database/entities/base';

@Entity('stages')
export class StageEntity extends BaseEntity {
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Index()
  @Column('uuid')
  requirementId!: string;

  @Column('text')
  name!: string;

  @Column('text', { default: 'other' })
  workDomain!: StageWorkDomain;

  @Column('integer')
  order!: number;

  @Column('jsonb', { default: () => "'[]'::jsonb" })
  ownerIds!: string[];

  @Column('text', { default: 'not_started' })
  status!: ExecutionStatus;

  @Column('text', { nullable: true })
  note!: string | null;

  @Column('text', { nullable: true })
  statusReason!: string | null;

  @Column('timestamptz', { nullable: true })
  expectedResumeAt!: Date | null;

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

  @Index()
  @Column('uuid', { nullable: true })
  supersededByStageId!: string | null;
}
