/* eslint-disable */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios from 'axios';
import * as XLSX from 'xlsx';
import https from 'https';
import { Cep } from './cep.entity';
import { CepStreamEvent } from './cep.types';
import { Express } from 'express';

const httpsAgent = new https.Agent({ family: 4 });

const CONCURRENCY = 3;
const BASE_DELAY = 400;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  registerStream(processId: string, emit: (e: CepStreamEvent) => void) {
    this.streams.set(processId, emit);
  }

  unregisterStream(processId: string) {
    this.streams.delete(processId);
  }

  private emit(processId: string, event: CepStreamEvent) {
    const fn = this.streams.get(processId);
    if (fn) fn(event);
  }

  /* =========================
     HELPERS
  ========================= */

  private normalizeCep(value: unknown): string | null {
    if (!value) return null;
    const cep = String(value).replace(/\D/g, '');
    return cep.length === 8 ? cep : null;
  }

  /* =========================
     APIs
  ========================= */

  /**
   * 🔴 CORREIOS (PRIMEIRA CONSULTA)
   * Requer token (contrato oficial)
   */
  private async fetchCorreios(cep: string) {
    const res = await axios.get(
      `${process.env.CORREIOS_API_URL}/enderecos/${cep}`,
      {
        timeout: 10000,
        headers: {
          Authorization: `Bearer ${process.env.CORREIOS_API_TOKEN}`,
        },
        httpsAgent,
      },
    );

    return {
      logradouro: res.data.logradouro ?? '',
      cidade: res.data.cidade,
      uf: res.data.uf,
      fonte: 'Correios',
    };
  }

  /**
   * ViaCEP
   */
  private async fetchViaCep(cep: string) {
    const res = await axios.get(`https://viacep.com.br/ws/${cep}/json/`, {
      timeout: 10000,
      httpsAgent,
    });

    if (res.data?.erro) return null;

    return {
      logradouro: res.data.logradouro ?? '',
      cidade: res.data.localidade,
      uf: res.data.uf,
      fonte: 'ViaCEP',
    };
  }

  /**
   * BrasilAPI
   */
  private async fetchBrasilApi(cep: string) {
    const res = await axios.get(`https://brasilapi.com.br/api/cep/v1/${cep}`, {
      timeout: 10000,
    });

    return {
      logradouro: res.data.street ?? '',
      cidade: res.data.city,
      uf: res.data.state,
      fonte: 'BrasilAPI',
    };
  }

  /* =========================
     PROCESSAMENTO
  ========================= */

  async startProcess(file: Express.Multer.File, processId: string) {
    /* ===== Ler planilha ===== */
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    const ceps = rows
      .map((r) => this.normalizeCep(r['cep'] ?? r['CEP']))
      .filter((c): c is string => Boolean(c));

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
    const worker = async () => {
      while (queue.length) {
        const cep = queue.shift();
        if (!cep) return;

        index++;

        /* --- Já existe --- */
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

        let data: {
          logradouro: string;
          cidade: string;
          uf: string;
          fonte: string;
        } | null = null;

        /* --- CORREIOS (1º) --- */
        try {
          data = await this.fetchCorreios(cep);
        } catch {}

        /* --- ViaCEP (2º) --- */
        if (!data) {
          try {
            data = await this.fetchViaCep(cep);
          } catch {}
        }

        /* --- BrasilAPI (3º) --- */
        if (!data) {
          try {
            data = await this.fetchBrasilApi(cep);
          } catch {
            this.emit(processId, {
              processId,
              index,
              total,
              cep,
              status: 'ERROR',
              reason: 'Falha Correios + ViaCEP + BrasilAPI',
            });
            await delay(BASE_DELAY);
            continue;
          }
        }

        /* --- Salvar --- */
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

    /* ===== Executar pool ===== */
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    this.unregisterStream(processId);
  }
}
