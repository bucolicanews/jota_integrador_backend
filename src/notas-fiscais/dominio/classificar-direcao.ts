import { DirecaoNotaFiscal } from './nota-fiscal';

const normalizarDocumento = (valor: string): string => valor.replace(/\D/g, '');

/**
 * Decide automaticamente se a nota é de ENTRADA (empresa-cliente é o destinatário --
 * compra) ou SAÍDA (empresa-cliente é o emitente -- venda), comparando o CNPJ da empresa
 * contra emitente/destinatário da nota. Lança erro se nenhum dos dois bater -- nota de
 * terceiro sem relação com a empresa nunca deveria ter sido enviada pelo agente dela.
 */
export function classificarDirecao(
  cnpjEmpresa: string,
  emitenteCnpj: string,
  destinatarioDocumento: string | null,
): DirecaoNotaFiscal {
  const empresa = normalizarDocumento(cnpjEmpresa);
  if (normalizarDocumento(emitenteCnpj) === empresa) return 'saida';
  if (destinatarioDocumento && normalizarDocumento(destinatarioDocumento) === empresa) return 'entrada';
  throw new Error('CNPJ da empresa não aparece como emitente nem destinatário desta nota fiscal');
}
