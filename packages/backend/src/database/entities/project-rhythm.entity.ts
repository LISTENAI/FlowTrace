import type { TemplateStage } from '@flowtrace/shared';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/database/entities/base';

@Entity('project_rhythms')
export class ProjectRhythmEntity extends BaseEntity {
  @Index({ unique: true })
  @Column('text')
  name!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  @Column('jsonb', { default: () => "'[]'::jsonb" })
  stages!: TemplateStage[];

  @Column('integer', { default: 0 })
  sortOrder!: number;
}
