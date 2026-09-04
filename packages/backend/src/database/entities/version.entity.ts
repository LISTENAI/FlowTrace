import type { VersionStatus } from '@flowtrace/shared';
import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/database/entities/base';

@Entity('versions')
@Index(['projectId', 'name'], { unique: true })
export class VersionEntity extends BaseEntity {
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Index()
  @Column('uuid')
  projectId!: string;

  @Column('text')
  name!: string;

  @Column('text', { default: 'planning' })
  status!: VersionStatus;

  @Column('integer', { default: 0 })
  sortOrder!: number;

  @Column('timestamptz', { nullable: true })
  plannedStartAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  plannedReleaseAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  actualReleaseAt!: Date | null;

  @Column('text', { nullable: true })
  description!: string | null;
}
