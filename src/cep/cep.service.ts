import { Injectable, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CorreiosService } from '../correios/correios.service';
import { CorreiosCepV3Response } from '../correios/dto/correios-cep.dto';
import { Cep } from './cep.entity';

export interface CepResponse {
  cep: string;
  logradouro?: string;
  bairro?: string;
  cidade: string;
  uf: string;
  origem: 'CORREIOS';
}

@Injectable()
export class CepService {
  constructor(
    private readonly correiosService: CorreiosService,

    @InjectRepository(Cep)
    private readonly cepRepository: Repository<Cep>,
  ) {}

  // ======================================================
  // CACHE-FIRST (OPCIONAL, MANTIDO)
  // ======================================================
  private async buscarNoBanco(cep: string): Promise<Cep | null> {
    return this.cepRepository.findOne({ where: { cep } });
  }

  // ======================================================
  // UPSERT
  // ======================================================
  private async upsertDimCep(data: {
    cep: string;
    cidade: string;
    uf: string;
  }): Promise<void> {
    await this.cepRepository.save({
      cep: data.cep,
      cidade: data.cidade,
      uf: data.uf,
      cepUnico: true,
      fonte: 'CORREIOS',
      dtAtualizacao: new Date(),
    });
  }

  // ======================================================
  // FLUXO ÚNICO — CORREIOS
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
        origem: 'CORREIOS',
      };
    }

    // =========================
    // CORREIOS (SEM FALLBACK)
    // =========================
    try {
      const correios: CorreiosCepV3Response =
        await this.correiosService.consultarCep(cep);

      await this.upsertDimCep({
        cep: correios.cep,
        cidade: correios.localidade,
        uf: correios.uf,
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
      // 🔥 ERRO REAL — NÃO ENGOLIR
      console.error('🚨 ERRO CORREIOS (ISOLADO):', error);

      throw new HttpException('Falha ao consultar CEP nos Correios', 503);
    }
  }
}
