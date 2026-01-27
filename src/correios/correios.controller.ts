import { Controller, Get, Param } from '@nestjs/common';
import { CorreiosService } from './correios.service';
import { CorreiosCepV3Response } from './dto/correios-cep.dto';

@Controller('correios')
export class CorreiosController {
  constructor(private readonly correiosService: CorreiosService) {}

  // =========================
  // CONSULTA CEP — API BUSCA CEP V3
  // =========================
  @Get('cep/:cep')
  async consultarCep(
    @Param('cep') cep: string,
  ): Promise<CorreiosCepV3Response> {
    return this.correiosService.consultarCep(cep);
  }
}
