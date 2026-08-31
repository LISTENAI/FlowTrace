import type { ChangeSource } from '@flowtrace/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('change_events')
@Index(['occurredAt'])
@Index(['projectId', 'occurredAt'])
export class ChangeEventEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('text')
  entityType!: string;

  @Column('uuid')
  entityId!: string;

  @Column('uuid', { nullable: true })
  projectId!: string | null;

  @Column('uuid', { nullable: true })
  requirementId!: string | null;

  @Column('text')
  type!: string;

  @Column('text')
  summary!: string;

  @Column('jsonb', { nullable: true })
  details!: Record<string, unknown> | null;

  @Column('text', { nullable: true })
  reason!: string | null;

  @Column('text')
  source!: ChangeSource;

  @Column('text', { nullable: true })
  agentName!: string | null;

  @Column('text', { nullable: true })
  agentModel!: string | null;

  @Column('timestamptz')
  occurredAt!: Date;
}
