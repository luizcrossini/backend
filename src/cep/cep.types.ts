export type CepStatus = 'SUCCESS' | 'ERROR' | 'SKIPPED';

export interface CepStreamEvent {
  processId: string;
  index: number;
  total: number;
  cep: string;
  status: CepStatus;
  reason?: string;
  logradouro?: string | null;
  cidade?: string;
  uf?: string;
  cep_unico?: boolean;
}
