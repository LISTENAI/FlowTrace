import type { ChangeSource, ExecutionStatus } from '@flowtrace/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('status_history')
@Index(['entityType', 'entityId', 'effectiveAt'])
export class StatusHistoryEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column('text')
  entityType!: 'stage' | 'bug';

  @Column('text')
  entityId!: string;

  @Column('text', { nullable: true })
  fromStatus!: ExecutionStatus | null;

  @Column('text')
  toStatus!: ExecutionStatus;

  @Column('datetime')
  effectiveAt!: Date;

  @Column('text', { nullable: true })
  note!: string | null;

  @Column('text', { nullable: true })
  reason!: string | null;

  @Column('datetime', { nullable: true })
  expectedResumeAt!: Date | null;

  @Column('text')
  source!: ChangeSource;

  @Column('text', { nullable: true })
  agentName!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
