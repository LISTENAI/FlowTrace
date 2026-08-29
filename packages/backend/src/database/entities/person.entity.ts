import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/database/entities/base';

@Entity('people')
export class PersonEntity extends BaseEntity {
  @Column('text')
  name!: string;

  @Index('UQ_people_email', { unique: true })
  @Column('text', { nullable: true })
  email!: string | null;

  @Column('text', { nullable: true })
  note!: string | null;

  @Column('boolean', { default: true })
  active!: boolean;
}
