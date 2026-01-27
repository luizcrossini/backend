import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CepService } from './cep.service';
import { CepController } from './cep.controller';
import { Cep } from './cep.entity';
import { CorreiosModule } from '../correios/correios.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cep]), // 🔴 ESSENCIAL
    CorreiosModule,
  ],
  controllers: [CepController],
  providers: [CepService],
})
export class CepModule {}
