import type { TemplateStage } from '@flowtrace/shared';
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

  @Column('simple-json', { default: '[]' })
  templateStages!: TemplateStage[];

  @Column('integer', { default: 0 })
  requirementSequence!: number;

  @Column('integer', { default: 0 })
  bugSequence!: number;
}
