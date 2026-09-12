export type StatusProtocolo = 'criado' | 'impresso' | 'transito' | 'entregue' | 'cancelado' | 'problema';
export const STATUS_PROTOCOLO: StatusProtocolo[] = ['criado', 'impresso', 'transito', 'entregue', 'cancelado', 'problema'];

/** Terminal: não aceita mais nenhuma transição. */
export function ehStatusTerminal(status: StatusProtocolo): boolean {
  return status === 'entregue' || status === 'cancelado' || status === 'problema';
}

/** criado->impresso ou impresso->transito -- avanço simples, sem efeito colateral de upload. */
export function transicaoSimplesValida(atual: StatusProtocolo, novo: StatusProtocolo): boolean {
  return (atual === 'criado' && novo === 'impresso') || (atual === 'impresso' && novo === 'transito');
}

/** cancelado/problema só a partir de um estado não-terminal -- nunca de um protocolo já entregue/cancelado/com problema. */
export function transicaoCancelamentoValida(atual: StatusProtocolo): boolean {
  return !ehStatusTerminal(atual);
}

/** Editar campos livres ou excluir só faz sentido antes do documento já estar em trânsito com o cliente. */
export function podeEditarOuExcluir(status: StatusProtocolo): boolean {
  return status === 'criado' || status === 'impresso';
}

/** PROT-<8 últimos dígitos do timestamp> -- não é documento fiscal, não precisa ser sequência gapless; único por empresa garantido pelo índice único (empresa_id, numero_protocolo). */
export function gerarNumeroProtocolo(): string {
  return `PROT-${Date.now().toString().slice(-8)}`;
}
