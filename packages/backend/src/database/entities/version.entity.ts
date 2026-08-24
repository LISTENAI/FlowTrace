import type { VersionStatus } from '@flowtrace/shared';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/database/entities/base';

@Entity('versions')
@Index(['projectId', 'name'], { unique: true })
export class VersionEntity extends BaseEntity {
  @Index()
  @Column('text')
  projectId!: string;

  @Column('text')
  name!: string;

  @Column('text', { default: 'planning' })
  status!: VersionStatus;

  @Column('integer', { default: 0 })
  sortOrder!: number;

  @Column('datetime', { nullable: true })
  plannedStartAt!: Date | null;

  @Column('datetime', { nullable: true })
  plannedReleaseAt!: Date | null;

  @Column('datetime', { nullable: true })
  actualReleaseAt!: Date | null;

  @Column('text', { nullable: true })
  description!: string | null;
}
