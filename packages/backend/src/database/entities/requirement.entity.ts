import type { RequirementLifecycle } from '@flowtrace/shared';
import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/database/entities/base';

@Entity('requirements')
export class RequirementEntity extends BaseEntity {
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Index({ unique: true })
  @Column('text')
  key!: string;

  @Index()
  @Column('uuid')
  projectId!: string;

  @Index()
  @Column('uuid', { nullable: true })
  versionId!: string | null;

  @Column('text')
  title!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  @Column('jsonb', { default: () => "'[]'::jsonb" })
  ownerIds!: string[];

  @Column('text', { default: 'not_started' })
  lifecycle!: RequirementLifecycle;

  @Column('timestamptz', { nullable: true })
  baselineStartAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  baselineEndAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  plannedStartAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  plannedEndAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  actualStartAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  actualEndAt!: Date | null;
}
