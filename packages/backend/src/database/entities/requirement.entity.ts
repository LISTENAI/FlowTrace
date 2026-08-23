import type { RequirementLifecycle } from '@flowtrace/shared';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/database/entities/base';

@Entity('requirements')
export class RequirementEntity extends BaseEntity {
  @Index({ unique: true })
  @Column('text')
  key!: string;

  @Index()
  @Column('text')
  projectId!: string;

  @Index()
  @Column('text', { nullable: true })
  versionId!: string | null;

  @Column('text')
  title!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  @Column('simple-json', { default: '[]' })
  ownerIds!: string[];

  @Column('text', { default: 'not_started' })
  lifecycle!: RequirementLifecycle;

  @Column('datetime', { nullable: true })
  baselineStartAt!: Date | null;

  @Column('datetime', { nullable: true })
  baselineEndAt!: Date | null;

  @Column('datetime', { nullable: true })
  plannedStartAt!: Date | null;

  @Column('datetime', { nullable: true })
  plannedEndAt!: Date | null;

  @Column('datetime', { nullable: true })
  actualStartAt!: Date | null;

  @Column('datetime', { nullable: true })
  actualEndAt!: Date | null;
}
