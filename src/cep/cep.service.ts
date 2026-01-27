import { Injectable, HttpException } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CorreiosService } from '../correios/correios.service';
import { Cep } from './cep.entity';
import { ViaCepResponse } from './dto/viacep.dto';
import { BrasilApiCepResponse } from './dto/brasilapi.dto';

/**
 * CONTRATO DA API (o que o frontend recebe)
 */
export interface CepResponse {
  cep: string;
  logradouro?: string;
  bairro?: string;
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

  // ======================================================
  // SALVA APENAS O QUE EXISTE NA TABELA geo.dim_cep
  // ======================================================
  private async salvarDimCep(data: {
    cep: string;
    cidade: string;
    uf: string;
    fonte: 'CORREIOS' | 'VIACEP' | 'BRASILAPI';
  }): Promise<void> {
    const entity = this.cepRepository.create({
      cep: data.cep,
      cidade: data.cidade,
      uf: data.uf,
      cepUnico: true,
      fonte: data.fonte,
      dtAtualizacao: new Date(),
    });

    await this.cepRepository.save(entity);
  }

  // ======================================================
  // FLUXO PRINCIPAL
  // ======================================================
  async buscarCep(cep: string): Promise<CepResponse> {
    // =========================
    // 1️⃣ CORREIOS (PRIORIDADE)
    // =========================
    try {
      const correios = await this.correiosService.consultarCep(cep);

      await this.salvarDimCep({
        cep: correios.cep,
        cidade: correios.municipio,
        uf: correios.uf,
        fonte: 'CORREIOS',
      });

      return {
        cep: correios.cep,
        logradouro: correios.logradouro,
        bairro: correios.bairro,
        cidade: correios.municipio,
        uf: correios.uf,
        origem: 'CORREIOS',
      };
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
        await this.salvarDimCep({
          cep: viaCep.cep,
          cidade: viaCep.localidade,
          uf: viaCep.uf,
          fonte: 'VIACEP',
        });

        return {
          cep: viaCep.cep,
          logradouro: viaCep.logradouro,
          bairro: viaCep.bairro,
          cidade: viaCep.localidade,
          uf: viaCep.uf,
          origem: 'VIACEP',
        };
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

      await this.salvarDimCep({
        cep: brasilApi.cep,
        cidade: brasilApi.city,
        uf: brasilApi.state,
        fonte: 'BRASILAPI',
      });

      return {
        cep: brasilApi.cep,
        logradouro: brasilApi.street,
        bairro: brasilApi.neighborhood,
        cidade: brasilApi.city,
        uf: brasilApi.state,
        origem: 'BRASILAPI',
      };
    } catch {
      // fallback silencioso
    }

    // =========================
    // NADA FUNCIONOU
    // =========================
    throw new HttpException('CEP não encontrado', 404);
  }
}
