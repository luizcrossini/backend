import { Injectable, HttpException, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { CorreiosCepV3Response } from './dto/correios-cep.dto';
import { httpsAgentIPv4 } from '../http/ipv4-agent';

@Injectable()
export class CorreiosService {
  private readonly logger = new Logger(CorreiosService.name);

  async consultarCep(cep: string): Promise<CorreiosCepV3Response> {
    try {
      const response: AxiosResponse<CorreiosCepV3Response> = await axios.get(
        `${process.env.CORREIOS_CEP_V3_URL}/${cep}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.CORREIOS_BEARER_TOKEN}`,
            Accept: 'application/json',
          },
          httpsAgent: httpsAgentIPv4, // 🔥 FORÇA IPv4
          timeout: 8000, // 🔥 evita travar container
        },
      );

      return {
        fonte: 'correios',
        ...response.data,
      } as CorreiosCepV3Response;
    } catch (error: unknown) {
      // 🔴 erro de rede (Render)
      if (
        axios.isAxiosError(error) &&
        (error.code === 'EHOSTUNREACH' || error.code === 'ENETUNREACH')
      ) {
        this.logger.error(`Erro de rede ao consultar Correios (${cep})`);
        throw new HttpException(
          'Serviço dos Correios indisponível (erro de rede)',
          503,
        );
      }

      // 🔴 erro HTTP retornado pela API dos Correios
      if (axios.isAxiosError(error)) {
        this.logger.warn(
          `Erro Correios ${error.response?.status} para CEP ${cep}`,
        );

        throw new HttpException(
          'Erro ao consultar CEP nos Correios (v3)',
          error.response?.status ?? 502,
        );
      }

      // 🔴 erro inesperado
      this.logger.error(`Erro inesperado ao consultar CEP ${cep}`);
      throw new HttpException(
        'Erro inesperado ao consultar CEP nos Correios (v3)',
        500,
      );
    }
  }
}
