import { DirecaoNotaFiscal } from '../../notas-fiscais/dominio/nota-fiscal';

const normalizarDocumento = (valor: string): string => valor.replace(/\D/g, '');

/**
 * Mesmo princípio de classificar-direcao.ts (NFe/NFCe), mas emitente/destinatário aqui são
 * prestador (emit) e tomador (toma) -- empresa PRESTOU serviço (emit) = SAÍDA (receita);
 * empresa TOMOU serviço de terceiro (toma) = ENTRADA (despesa).
 */
export function classificarDirecaoServico(
  cnpjOuCpfEmpresa: string,
  emitenteCnpj: string | null,
  emitenteCpf: string | null,
  tomadorCnpj: string | null,
  tomadorCpf: string | null,
): DirecaoNotaFiscal {
  const empresa = normalizarDocumento(cnpjOuCpfEmpresa);
  const emitente = emitenteCnpj ?? emitenteCpf;
  if (emitente && normalizarDocumento(emitente) === empresa) return 'saida';
  const tomador = tomadorCnpj ?? tomadorCpf;
  if (tomador && normalizarDocumento(tomador) === empresa) return 'entrada';
  throw new Error('CNPJ/CPF da empresa não aparece como prestador nem tomador desta NFS-e');
}
