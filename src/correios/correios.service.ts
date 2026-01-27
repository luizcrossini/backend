import { Injectable, HttpException } from '@nestjs/common';
import axios from 'axios';
import https from 'https';
import { CorreiosCepV3Response } from './dto/correios-cep.dto';

const httpsAgent = new https.Agent({
  family: 4, // 🔥 FORÇA IPV4
});

@Injectable()
export class CorreiosService {
  async consultarCep(cep: string): Promise<CorreiosCepV3Response> {
    try {
      const response = await axios.get<CorreiosCepV3Response>(
        `${process.env.CORREIOS_CEP_V3_URL}/${cep}`,
        {
          httpsAgent,
          timeout: 8000,
          headers: {
            Authorization: `Bearer ${process.env.CORREIOS_BEARER_TOKEN}`,
            Accept: 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('🚨 ERRO REDE CORREIOS:', error);
      throw new HttpException('Falha de comunicação com os Correios', 503);
    }
  }
}
