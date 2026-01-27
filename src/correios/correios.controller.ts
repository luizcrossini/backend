import { Controller, Get, Param } from '@nestjs/common';
import { CorreiosService } from './correios.service';
import { CorreiosCepResponse } from './dto/correios-cep.dto';

@Controller('correios')
export class CorreiosController {
  constructor(private readonly correiosService: CorreiosService) {}

  // =========================
  // TESTE DE TOKEN
  // =========================
  @Get('token')
  async gerarToken(): Promise<{ token: string }> {
    const token = await this.correiosService['gerarToken']();
    return { token };
  }

  // =========================
  // CONSULTA CEP
  // =========================
  @Get('cep/:cep')
  async consultarCep(@Param('cep') cep: string): Promise<CorreiosCepResponse> {
    return this.correiosService.consultarCep(cep);
  }
}
