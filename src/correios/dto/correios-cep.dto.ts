export interface CorreiosCepV3Response {
  cep: string;
  uf: string;
  localidade: string;
  logradouro?: string;
  bairro?: string;
}
