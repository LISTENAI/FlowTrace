import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@/database/entities/base';

@Entity('people')
export class PersonEntity extends BaseEntity {
  @Column('text')
  name!: string;

  @Column('text', { nullable: true })
  note!: string | null;

  @Column('boolean', { default: true })
  active!: boolean;
}
