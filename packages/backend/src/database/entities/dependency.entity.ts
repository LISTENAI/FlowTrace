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
  @PrimaryColumn('uuid')
  id!: string;

  @Column('text')
  successorType!: DependencyTargetType;

  @Column('uuid')
  successorId!: string;

  @Column('text')
  predecessorType!: DependencyTargetType;

  @Column('uuid')
  predecessorId!: string;

  @Column('text', { nullable: true })
  note!: string | null;

  @Column('boolean', { default: true })
  active!: boolean;

  @Column('text')
  source!: ChangeSource;

  @Column('text', { nullable: true })
  agentName!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column('timestamptz', { nullable: true })
  resolvedAt!: Date | null;
}
