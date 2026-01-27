import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('ceps')
export class Cep {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 9 })
  cep: string;

  @Column()
  logradouro: string;

  @Column()
  bairro: string;

  @Column()
  cidade: string;

  @Column({ length: 2 })
  uf: string;

  @Column()
  origem: string;

  @CreateDateColumn()
  createdAt: Date;
}
