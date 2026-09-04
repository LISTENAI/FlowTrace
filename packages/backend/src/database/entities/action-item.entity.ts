import type { ExecutionStatus } from '@flowtrace/shared';
import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/database/entities/base';

@Entity('action_items')
export class ActionItemEntity extends BaseEntity {
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Index({ unique: true })
  @Column('text')
  key!: string;

  @Column('text')
  title!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  @Index()
  @Column('uuid', { nullable: true })
  projectId!: string | null;

  @Index()
  @Column('uuid', { nullable: true })
  requirementId!: string | null;

  @Column('jsonb', { default: () => "'[]'::jsonb" })
  ownerIds!: string[];

  @Column('text', { default: 'not_started' })
  status!: ExecutionStatus;

  @Column('text', { nullable: true })
  statusReason!: string | null;

  @Column('timestamptz', { nullable: true })
  expectedResumeAt!: Date | null;

  @Index()
  @Column('uuid')
  createdByPersonId!: string;

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
