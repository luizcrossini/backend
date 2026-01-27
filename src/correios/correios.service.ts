import { Injectable, HttpException, Logger } from '@nestjs/common';
import axios from 'axios';
import https from 'https';
import { CorreiosCepV3Response } from './dto/correios-cep.dto';

// 🔥 AGENT FORÇANDO IPV4
const httpsAgentIPv4 = new https.Agent({
  family: 4, // FORÇA IPV4
  keepAlive: true,
});

@Injectable()
export class CorreiosService {
  private readonly logger = new Logger(CorreiosService.name);

  async consultarCep(cep: string): Promise<CorreiosCepV3Response> {
    try {
      const response = await axios.get<CorreiosCepV3Response>(
        `${process.env.CORREIOS_CEP_V3_URL}/${cep}`,
        {
          httpsAgent: httpsAgentIPv4,
          timeout: 10000,
          headers: {
            Authorization: `Bearer ${process.env.CORREIOS_BEARER_TOKEN}`,
            Accept: 'application/json',
          },
        },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Erro ao consultar CEP ${cep} nos Correios`,
        error?.cause || error,
      );

      throw new HttpException('Correios indisponível (falha de rede)', 503);
    }
  }
}
