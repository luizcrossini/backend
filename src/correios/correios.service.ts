import { Injectable, HttpException } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { CorreiosCepV3Response } from './dto/correios-cep.dto';

@Injectable()
export class CorreiosService {
  async consultarCep(cep: string): Promise<CorreiosCepV3Response> {
    try {
      const response: AxiosResponse<CorreiosCepV3Response> = await axios.get(
        `${process.env.CORREIOS_CEP_V3_URL}/${cep}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.CORREIOS_BEARER_TOKEN}`,
            Accept: 'application/json',
          },
        },
      );

      return response.data;
    } catch (error: unknown) {
      // tipagem segura do erro
      if (axios.isAxiosError(error)) {
        throw new HttpException(
          'Erro ao consultar CEP nos Correios (v3)',
          error.response?.status ?? 500,
        );
      }

      throw new HttpException(
        'Erro inesperado ao consultar CEP nos Correios (v3)',
        500,
      );
    }
  }
}
