import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('mutation_receipts')
export class MutationReceiptEntity {
  @PrimaryColumn('text') id!: string;
  @Column('uuid') requestId!: string;
  @Column('text') actorUserId!: string;
  @Column('text') fingerprint!: string;
  @Column('integer') statusCode!: number;
  @Column('jsonb') response!: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
