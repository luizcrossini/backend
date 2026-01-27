import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'dim_cep', schema: 'geo' })
export class Cep {
  @PrimaryColumn({ type: 'varchar', length: 8 })
  cep: string;

  @Column({ type: 'varchar' })
  cidade: string;

  @Column({ type: 'bpchar', length: 2 })
  uf: string;

  @Column({ type: 'boolean', name: 'cep_unico' })
  cepUnico: boolean;

  @Column({ type: 'varchar' })
  fonte: string;

  @Column({ type: 'timestamp', name: 'dt_atualizacao' })
  dtAtualizacao: Date;
}
