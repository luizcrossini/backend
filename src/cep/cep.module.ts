import { Module } from '@nestjs/common';
import { CepService } from './cep.service';
import { CepController } from './cep.controller';
import { CorreiosModule } from '../correios/correios.module';

@Module({
  imports: [CorreiosModule],
  controllers: [CepController],
  providers: [CepService],
})
export class CepModule {}
