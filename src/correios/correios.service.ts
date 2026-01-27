import { Injectable, HttpException } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { CorreiosTokenResponse } from './dto/correios-token.dto';
import { CorreiosCepResponse } from './dto/correios-cep.dto';

@Injectable()
export class CorreiosService {
  private token: string | null = null;
  private tokenExpiresAt: number | null = null;

  // =========================
  // TOKEN
  // =========================
  private async gerarToken(): Promise<string> {
    if (this.token && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }

    let response: AxiosResponse<CorreiosTokenResponse>;

    try {
      response = await axios.post<CorreiosTokenResponse>(
        process.env.CORREIOS_TOKEN_URL as string,
        {
          numeroContrato: process.env.CORREIOS_CONTRATO,
          codigoAcesso: process.env.CORREIOS_CODIGO_ACESSO,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    } catch {
      throw new HttpException('Erro ao autenticar na API dos Correios', 500);
    }

    this.token = response.data.token;

    // margem de segurança antes da expiração real
    this.tokenExpiresAt = Date.now() + 29 * 60 * 1000;

    return this.token;
  }

  // =========================
  // CONSULTA CEP
  // =========================
  async consultarCep(cep: string): Promise<CorreiosCepResponse> {
    const token = await this.gerarToken();

    try {
      const response = await axios.post<CorreiosCepResponse>(
        process.env.CORREIOS_CEP_URL as string,
        { cep },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error: unknown) {
      // Token expirou → limpa cache e tenta 1x novamente
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        this.token = null;
        this.tokenExpiresAt = null;

        const novoToken = await this.gerarToken();

        const retry = await axios.post<CorreiosCepResponse>(
          process.env.CORREIOS_CEP_URL as string,
          { cep },
          {
            headers: {
              Authorization: `Bearer ${novoToken}`,
              'Content-Type': 'application/json',
            },
          },
        );

        return retry.data;
      }

      // =========================
      // FALLBACK (ViaCEP)
      // =========================
      try {
        const fallback = await axios.get<CorreiosCepResponse>(
          `https://viacep.com.br/ws/${cep}/json/`,
        );

        return fallback.data;
      } catch {
        throw new HttpException('CEP não encontrado', 404);
      }
    }
  }
}
