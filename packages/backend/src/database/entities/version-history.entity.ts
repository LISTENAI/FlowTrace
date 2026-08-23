import type { ChangeSource } from '@flowtrace/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('version_history')
@Index(['requirementId', 'changedAt'])
export class VersionHistoryEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column('text')
  requirementId!: string;

  @Column('text', { nullable: true })
  fromVersionId!: string | null;

  @Column('text', { nullable: true })
  toVersionId!: string | null;

  @Column('text', { nullable: true })
  reason!: string | null;

  @Column('text')
  source!: ChangeSource;

  @Column('text', { nullable: true })
  agentName!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  changedAt!: Date;
}
