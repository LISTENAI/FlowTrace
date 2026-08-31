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
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  requirementId!: string;

  @Column('uuid', { nullable: true })
  fromVersionId!: string | null;

  @Column('uuid', { nullable: true })
  toVersionId!: string | null;

  @Column('text', { nullable: true })
  reason!: string | null;

  @Column('text')
  source!: ChangeSource;

  @Column('text', { nullable: true })
  agentName!: string | null;

  @Column('text', { nullable: true })
  agentModel!: string | null;

  @Column('timestamptz', { nullable: true })
  effectiveAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  changedAt!: Date;
}
