import type { ChangeSource, ChangeEventContext } from '@flowtrace/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('change_events')
@Index(['occurredAt'])
@Index(['projectId', 'occurredAt'])
@Index(['versionId', 'occurredAt', 'id'])
@Index(['relatedVersionId', 'occurredAt', 'id'])
export class ChangeEventEntity {
  @Column('jsonb', { nullable: true })
  actor!: { userId: string; personId: string; name: string } | null;
  @Column('text', { nullable: true }) sourceRef!: string | null;
  @Column('timestamptz', { nullable: true }) reportedAt!: Date | null;

  @Column('uuid', { nullable: true })
  mutationId!: string | null;

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

  @Column('uuid', { nullable: true })
  versionId!: string | null;

  @Column('uuid', { nullable: true })
  relatedVersionId!: string | null;

  @Column('jsonb', { nullable: true })
  eventContext!: ChangeEventContext | null;

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
