import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'dim_cep', schema: 'geo' })
export class Cep {
  @PrimaryColumn({ length: 8 })
  cep: string;

  @Column()
  cidade: string;

  @Column({ length: 2, type: 'char' })
  uf: string;

  @Column({ name: 'cep_unico', type: 'boolean' })
  cepUnico: boolean;

  @Column()
  fonte: string;

  @Column({ name: 'dt_atualizacao', type: 'timestamp' })
  dtAtualizacao: Date;
}
