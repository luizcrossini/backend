import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cep } from './cep.entity';
import { CepService } from '../cep/cep.service';
import { CepController } from './cep.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cep])],
  controllers: [CepController],
  providers: [CepService],
})
export class CepModule {}
