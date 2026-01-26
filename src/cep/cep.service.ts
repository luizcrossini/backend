import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import * as XLSX from 'xlsx';
import https from 'https';
import { Cep } from './cep.entity';
import { CepStreamEvent } from './cep.types';
import { Express } from 'express';

const httpsAgent = new https.Agent({ family: 4 });

const CONCURRENCY = 3;
const BASE_DELAY = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* =========================
   TIPOS DAS APIS
========================= */

interface ViaCepResponse {
  logradouro?: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface BrasilApiResponse {
  street?: string;
  city: string;
  state: string;
}

interface ApicepResponse {
  address?: string;
  city: string;
  state: string;
}

interface CepApiResult {
  logradouro: string;
  cidade: string;
  uf: string;
  fonte: string;
}

@Injectable()
export class CepService {
  private streams = new Map<string, (event: CepStreamEvent) => void>();

  constructor(
    @InjectRepository(Cep)
    private readonly cepRepo: Repository<Cep>,
  ) {}

  /* =========================
     STREAM
  ========================= */

  registerStream(processId: string, emit: (e: CepStreamEvent) => void): void {
    this.streams.set(processId, emit);
  }

  unregisterStream(processId: string): void {
    this.streams.delete(processId);
  }

  private emit(processId: string, event: CepStreamEvent): void {
    const fn = this.streams.get(processId);
    if (fn) fn(event);
  }

  /* =========================
     HELPERS
  ========================= */

  private normalizeCep(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;

    const cep = String(value).replace(/\D/g, '');
    return cep.length === 8 ? cep : null;
  }

  /* =========================
     APIs
  ========================= */

  private async fetchViaCep(cep: string): Promise<CepApiResult | null> {
    const res: AxiosResponse<ViaCepResponse> = await axios.get(
      `https://viacep.com.br/ws/${cep}/json/`,
      { timeout: 10000, httpsAgent },
    );

    if (res.data.erro) return null;

    return {
      logradouro: res.data.logradouro ?? '',
      cidade: res.data.localidade,
      uf: res.data.uf,
      fonte: 'ViaCEP',
    };
  }

  private async fetchBrasilApi(cep: string): Promise<CepApiResult> {
    const res: AxiosResponse<BrasilApiResponse> = await axios.get(
      `https://brasilapi.com.br/api/cep/v1/${cep}`,
      { timeout: 10000 },
    );

    return {
      logradouro: res.data.street ?? '',
      cidade: res.data.city,
      uf: res.data.state,
      fonte: 'BrasilAPI',
    };
  }

  private async fetchApicep(cep: string): Promise<CepApiResult> {
    const res: AxiosResponse<ApicepResponse> = await axios.get(
      `https://cdn.apicep.com/file/apicep/${cep}.json`,
      { timeout: 10000 },
    );

    return {
      logradouro: res.data.address ?? '',
      cidade: res.data.city,
      uf: res.data.state,
      fonte: 'Apicep',
    };
  }

  /* =========================
     PROCESSAMENTO
  ========================= */

  async startProcess(
    file: Express.Multer.File,
    processId: string,
  ): Promise<void> {
    /* ===== Ler planilha ===== */
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    const ceps = rows
      .map((r) => this.normalizeCep(r['cep'] ?? r['CEP']))
      .filter((c): c is string => c !== null);

    const cepsUnicos = [...new Set(ceps)];
    const total = cepsUnicos.length;

    /* ===== Buscar existentes ===== */
    const existentes = await this.cepRepo.find({
      where: { cep: In(cepsUnicos) },
    });

    const existentesMap = new Map(existentes.map((c) => [c.cep, c]));

    let index = 0;
    const queue = [...cepsUnicos];

    /* ===== WORKER ===== */
    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        const cep = queue.shift();
        if (!cep) return;

        index++;

        if (existentesMap.has(cep)) {
          const e = existentesMap.get(cep)!;

          this.emit(processId, {
            processId,
            index,
            total,
            cep,
            status: 'SKIPPED',
            reason: 'Já estava no banco',
            logradouro: e.logradouro ?? undefined,
            cidade: e.cidade,
            uf: e.uf,
            cep_unico: e.cep_unico,
          });

          continue;
        }

        let data: CepApiResult | null = null;

        try {
          data = await this.fetchViaCep(cep);
        } catch {}

        if (!data) {
          try {
            data = await this.fetchBrasilApi(cep);
          } catch {}
        }

        if (!data) {
          try {
            data = await this.fetchApicep(cep);
          } catch {
            this.emit(processId, {
              processId,
              index,
              total,
              cep,
              status: 'ERROR',
              reason: 'Falha ViaCEP + BrasilAPI + Apicep',
            });
            await delay(BASE_DELAY);
            continue;
          }
        }

        await this.cepRepo
          .createQueryBuilder()
          .insert()
          .into(Cep)
          .values({
            cep,
            logradouro: data.logradouro,
            cidade: data.cidade,
            uf: data.uf,
            cep_unico: false,
            fonte: data.fonte,
          })
          .orIgnore()
          .execute();

        this.emit(processId, {
          processId,
          index,
          total,
          cep,
          status: 'SUCCESS',
          logradouro: data.logradouro || undefined,
          cidade: data.cidade,
          uf: data.uf,
          cep_unico: false,
        });

        await delay(BASE_DELAY);
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    this.unregisterStream(processId);
  }
}
