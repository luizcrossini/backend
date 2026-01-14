import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'geo', name: 'dim_cep' })
export class Cep {
  @PrimaryColumn({ type: 'varchar', length: 8 })
  cep!: string;

  @Column({ type: 'varchar', nullable: true })
  logradouro?: string | null;

  @Column({ type: 'varchar', nullable: true })
  bairro?: string;

  @Column({ type: 'varchar' })
  cidade!: string;

  @Column({ type: 'char', length: 2 })
  uf!: string;

  @Column({ type: 'boolean', default: false })
  cep_unico!: boolean;

  @Column({ type: 'varchar', default: 'ViaCEP' })
  fonte!: string;
}
