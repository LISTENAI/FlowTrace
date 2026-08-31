import type { ChangeSource, TemplateStage } from '@flowtrace/shared';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/database/entities/base';

@Entity('projects')
export class ProjectEntity extends BaseEntity {
  @Index({ unique: true })
  @Column('text')
  key!: string;

  @Column('text')
  name!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  @Column('text', { nullable: true })
  agentHandoff!: string | null;

  @Column('integer', { default: 0 })
  agentHandoffRevision!: number;

  @Column('text', { nullable: true })
  agentHandoffSource!: ChangeSource | null;

  @Column('text', { nullable: true })
  agentHandoffAgentName!: string | null;

  @Column('text', { nullable: true })
  agentHandoffAgentModel!: string | null;

  @Column('text', { nullable: true })
  agentHandoffReason!: string | null;

  @Column('timestamptz', { nullable: true })
  agentHandoffUpdatedAt!: Date | null;

  @Column('jsonb', { default: () => "'[]'::jsonb" })
  templateStages!: TemplateStage[];

  @Column('integer', { default: 0 })
  requirementSequence!: number;

  @Column('integer', { default: 0 })
  bugSequence!: number;
}
