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
  @PrimaryColumn('text')
  id!: string;

  @Column('text')
  entityType!: 'requirement' | 'stage' | 'bug';

  @Column('text')
  entityId!: string;

  @Column('datetime', { nullable: true })
  oldStartAt!: Date | null;

  @Column('datetime', { nullable: true })
  oldEndAt!: Date | null;

  @Column('datetime', { nullable: true })
  newStartAt!: Date | null;

  @Column('datetime', { nullable: true })
  newEndAt!: Date | null;

  @Column('text', { nullable: true })
  reason!: string | null;

  @Column('text')
  source!: ChangeSource;

  @Column('text', { nullable: true })
  agentName!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  changedAt!: Date;
}
