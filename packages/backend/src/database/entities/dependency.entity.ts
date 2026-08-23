import type { ChangeSource, DependencyTargetType } from '@flowtrace/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('dependencies')
@Index(['successorType', 'successorId'])
@Index(['predecessorType', 'predecessorId'])
export class DependencyEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column('text')
  successorType!: DependencyTargetType;

  @Column('text')
  successorId!: string;

  @Column('text')
  predecessorType!: DependencyTargetType;

  @Column('text')
  predecessorId!: string;

  @Column('text', { nullable: true })
  note!: string | null;

  @Column('boolean', { default: true })
  active!: boolean;

  @Column('text')
  source!: ChangeSource;

  @Column('text', { nullable: true })
  agentName!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @Column('datetime', { nullable: true })
  resolvedAt!: Date | null;
}
