import type { ExecutionStatus } from '@flowtrace/shared';
import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/database/entities/base';

@Entity('stages')
export class StageEntity extends BaseEntity {
  @DeleteDateColumn({ type: 'datetime', nullable: true })
  deletedAt!: Date | null;

  @Index()
  @Column('text')
  requirementId!: string;

  @Column('text')
  name!: string;

  @Column('integer')
  order!: number;

  @Column('simple-json', { default: '[]' })
  ownerIds!: string[];

  @Column('text', { default: 'not_started' })
  status!: ExecutionStatus;

  @Column('text', { nullable: true })
  note!: string | null;

  @Column('text', { nullable: true })
  statusReason!: string | null;

  @Column('datetime', { nullable: true })
  expectedResumeAt!: Date | null;

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
