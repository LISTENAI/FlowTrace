import type { ChangeSource } from '@flowtrace/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('change_events')
@Index(['occurredAt'])
@Index(['projectId', 'occurredAt'])
export class ChangeEventEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column('text')
  entityType!: string;

  @Column('text')
  entityId!: string;

  @Column('text', { nullable: true })
  projectId!: string | null;

  @Column('text', { nullable: true })
  requirementId!: string | null;

  @Column('text')
  type!: string;

  @Column('text')
  summary!: string;

  @Column('simple-json', { nullable: true })
  details!: Record<string, unknown> | null;

  @Column('text', { nullable: true })
  reason!: string | null;

  @Column('text')
  source!: ChangeSource;

  @Column('text', { nullable: true })
  agentName!: string | null;

  @Column('datetime')
  occurredAt!: Date;
}
