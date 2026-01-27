import { Injectable, HttpException } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { CorreiosService } from '../correios/correios.service';
import { ViaCepResponse } from './dto/viacep.dto';
import { BrasilApiCepResponse } from './dto/brasilapi.dto';

export interface CepResponse {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  origem: 'CORREIOS' | 'VIACEP' | 'BRASILAPI';
}

@Injectable()
export class CepService {
  constructor(private readonly correiosService: CorreiosService) {}

  async buscarCep(cep: string): Promise<CepResponse> {
    // =========================
    // 1️⃣ CORREIOS
    // =========================
    try {
      const correios = await this.correiosService.consultarCep(cep);

      return {
        ...correios,
        origem: 'CORREIOS',
      };
    } catch {
      // fallback
    }

    // =========================
    // 2️⃣ VIA CEP
    // =========================
    try {
      const viaCepResponse: AxiosResponse<ViaCepResponse> =
        await axios.get<ViaCepResponse>(
          `https://viacep.com.br/ws/${cep}/json/`,
        );

      const viaCep = viaCepResponse.data;

      if (!viaCep.erro) {
        return {
          cep: viaCep.cep,
          logradouro: viaCep.logradouro,
          bairro: viaCep.bairro,
          municipio: viaCep.localidade,
          uf: viaCep.uf,
          origem: 'VIACEP',
        };
      }
    } catch {
      // fallback
    }

    // =========================
    // 3️⃣ BRASIL API
    // =========================
    try {
      const brasilApiResponse: AxiosResponse<BrasilApiCepResponse> =
        await axios.get<BrasilApiCepResponse>(
          `https://brasilapi.com.br/api/cep/v1/${cep}`,
        );

      const brasilApi = brasilApiResponse.data;

      return {
        cep: brasilApi.cep,
        logradouro: brasilApi.street,
        bairro: brasilApi.neighborhood,
        municipio: brasilApi.city,
        uf: brasilApi.state,
        origem: 'BRASILAPI',
      };
    } catch {
      // fallback
    }

    // =========================
    // NADA FUNCIONOU
    // =========================
    throw new HttpException('CEP não encontrado', 404);
  }
}
