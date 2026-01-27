import { Injectable, HttpException } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { CorreiosService } from '../correios/correios.service';
import { ViaCepResponse } from './dto/viacep.dto';
import { BrasilApiCepResponse } from './dto/brasilapi.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cep } from './cep.entity';

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
  constructor(
    private readonly correiosService: CorreiosService,

    @InjectRepository(Cep)
    private readonly cepRepository: Repository<Cep>,
  ) {}

  // =========================
  // MÉTODO CENTRAL DE SALVAMENTO
  // =========================
  private async salvarCep(data: CepResponse): Promise<CepResponse> {
    const entity = this.cepRepository.create(data);
    const saved = await this.cepRepository.save(entity);

    return {
      cep: saved.cep,
      logradouro: saved.logradouro,
      bairro: saved.bairro,
      cidade: saved.cidade,
      uf: saved.uf,
      origem: saved.origem as CepResponse['origem'],
    };
  }

  async buscarCep(cep: string): Promise<CepResponse> {
    // =========================
    // 1️⃣ CORREIOS (PRIORIDADE)
    // =========================
    try {
      const correios = await this.correiosService.consultarCep(cep);

      return this.salvarCep({
        cep: correios.cep,
        logradouro: correios.logradouro,
        bairro: correios.bairro,
        cidade: correios.municipio,
        uf: correios.uf,
        origem: 'CORREIOS',
      });
    } catch {
      // fallback silencioso
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
        return this.salvarCep({
          cep: viaCep.cep,
          logradouro: viaCep.logradouro,
          bairro: viaCep.bairro,
          cidade: viaCep.localidade,
          uf: viaCep.uf,
          origem: 'VIACEP',
        });
      }
    } catch {
      // fallback silencioso
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

      return this.salvarCep({
        cep: brasilApi.cep,
        logradouro: brasilApi.street,
        bairro: brasilApi.neighborhood,
        cidade: brasilApi.city,
        uf: brasilApi.state,
        origem: 'BRASILAPI',
      });
    } catch {
      // fallback silencioso
    }

    // =========================
    // NADA FUNCIONOU
    // =========================
    throw new HttpException('CEP não encontrado', 404);
  }
}
