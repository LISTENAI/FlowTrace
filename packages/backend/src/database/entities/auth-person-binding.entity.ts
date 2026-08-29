import { Column, Entity, Index } from 'typeorm';
import type { ProfileAuthority } from '@flowtrace/shared';
import { BaseEntity } from '@/database/entities/base';

@Entity('auth_person_bindings')
@Index('UQ_auth_person_provider_subject', ['providerId', 'providerSubject'], {
  unique: true,
})
export class AuthPersonBindingEntity extends BaseEntity {
  @Index('UQ_auth_person_user', { unique: true })
  @Column('text')
  authUserId!: string;

  @Index('UQ_auth_person_person', { unique: true })
  @Column('uuid')
  personId!: string;

  @Column('text')
  providerId!: string;

  @Column('text')
  providerSubject!: string;

  @Column('text')
  nameAuthority!: ProfileAuthority;

  @Column('text')
  emailAuthority!: ProfileAuthority;
}
