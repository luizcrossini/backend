import { Controller, Get, Param } from '@nestjs/common';
import { CepService } from './cep.service';
import { CepResponse } from './cep.service';

@Controller('cep')
export class CepController {
  constructor(private readonly cepService: CepService) {}

  @Get(':cep')
  async buscar(@Param('cep') cep: string): Promise<CepResponse> {
    return this.cepService.buscarCep(cep);
  }
}
