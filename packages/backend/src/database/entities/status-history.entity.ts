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
  @PrimaryColumn('uuid')
  id!: string;

  @Column('text')
  entityType!: 'stage' | 'bug' | 'action_item';

  @Column('uuid')
  entityId!: string;

  @Column('text', { nullable: true })
  fromStatus!: ExecutionStatus | null;

  @Column('text')
  toStatus!: ExecutionStatus;

  @Column('timestamptz')
  effectiveAt!: Date;

  @Column('text', { nullable: true })
  note!: string | null;

  @Column('text', { nullable: true })
  reason!: string | null;

  @Column('timestamptz', { nullable: true })
  expectedResumeAt!: Date | null;

  @Column('text')
  source!: ChangeSource;

  @Column('text', { nullable: true })
  agentName!: string | null;

  @Column('text', { nullable: true })
  agentModel!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
