import type { ChangeSource } from '@flowtrace/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('project_agent_handoff_history')
@Index(['projectId', 'revision'], { unique: true })
export class ProjectAgentHandoffRevisionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  projectId!: string;

  @Column('integer')
  revision!: number;

  @Column('text')
  content!: string;

  @Column('text')
  source!: ChangeSource;

  @Column('text', { nullable: true })
  agentName!: string | null;

  @Column('text', { nullable: true })
  agentModel!: string | null;

  @Column('text', { nullable: true })
  reason!: string | null;

  @Column('timestamptz')
  createdAt!: Date;
}
