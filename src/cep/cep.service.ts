import { Injectable, HttpException } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CorreiosService } from '../correios/correios.service';
import { CorreiosCepV3Response } from '../correios/dto/correios-cep.dto';
import { Cep } from './cep.entity';
import { ViaCepResponse } from './dto/viacep.dto';
import { BrasilApiCepResponse } from './dto/brasilapi.dto';

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
  // 1️⃣ CACHE-FIRST (BANCO)
  // ======================================================
  private async buscarNoBanco(cep: string): Promise<Cep | null> {
    return this.cepRepository.findOne({ where: { cep } });
  }

  // ======================================================
  // 2️⃣ UPSERT (SEM DUPLICAR)
  // ======================================================
  private async upsertDimCep(data: {
    cep: string;
    cidade: string;
    uf: string;
    fonte: 'CORREIOS' | 'VIACEP' | 'BRASILAPI';
  }): Promise<void> {
    await this.cepRepository.save({
      cep: data.cep,
      cidade: data.cidade,
      uf: data.uf,
      cepUnico: true,
      fonte: data.fonte,
      dtAtualizacao: new Date(),
    });
  }

  // ======================================================
  // 3️⃣ FLUXO PRINCIPAL
  // ======================================================
  async buscarCep(cep: string): Promise<CepResponse> {
    // -------------------------
    // CACHE FIRST
    // -------------------------
    const cache = await this.buscarNoBanco(cep);
    if (cache) {
      return {
        cep: cache.cep,
        cidade: cache.cidade,
        uf: cache.uf,
        origem: cache.fonte as CepResponse['origem'],
      };
    }

    // =========================
    // 1️⃣ CORREIOS — API BUSCA CEP V3 (SEMPRE PRIMEIRO)
    // =========================
    try {
      const correios: CorreiosCepV3Response =
        await this.correiosService.consultarCep(cep);

      await this.upsertDimCep({
        cep: correios.cep,
        cidade: correios.localidade,
        uf: correios.uf,
        fonte: 'CORREIOS',
      });

      return {
        cep: correios.cep,
        logradouro: correios.logradouro,
        bairro: correios.bairro,
        cidade: correios.localidade,
        uf: correios.uf,
        origem: 'CORREIOS',
      };
    } catch (error) {
      // 🔴 LOG EXPLÍCITO — ESSENCIAL PARA SABER POR QUE CAI NO FALLBACK
      console.error('❌ ERRO CORREIOS:', error);
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
        await this.upsertDimCep({
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
    } catch (error) {
      console.error('❌ ERRO VIA CEP:', error);
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

      await this.upsertDimCep({
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
    } catch (error) {
      console.error('❌ ERRO BRASIL API:', error);
    }

    throw new HttpException('CEP não encontrado', 404);
  }
}
