import type { ChangeSource } from '@flowtrace/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('schedule_history')
@Index(['entityType', 'entityId', 'changedAt'])
export class ScheduleHistoryEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('text')
  entityType!: 'requirement' | 'stage' | 'bug';

  @Column('uuid')
  entityId!: string;

  @Column('timestamptz', { nullable: true })
  oldStartAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  oldEndAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  newStartAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  newEndAt!: Date | null;

  @Column('text', { nullable: true })
  reason!: string | null;

  @Column('text')
  source!: ChangeSource;

  @Column('text', { nullable: true })
  agentName!: string | null;

  @Column('text', { nullable: true })
  agentModel!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  changedAt!: Date;
}
