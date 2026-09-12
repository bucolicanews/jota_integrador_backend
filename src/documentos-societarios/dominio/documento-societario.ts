export type StatusDocumentoSocietario = 'rascunho' | 'finalizado' | 'arquivado';
export const STATUS_DOCUMENTO_SOCIETARIO: StatusDocumentoSocietario[] = ['rascunho', 'finalizado', 'arquivado'];

export function podeEditar(status: StatusDocumentoSocietario): boolean {
  return status === 'rascunho';
}

/** Excluir de verdade só em rascunho -- "arquivar" é a forma correta de encerrar um documento já finalizado, nunca DELETE. */
export function podeExcluir(status: StatusDocumentoSocietario): boolean {
  return status === 'rascunho';
}

export function podeArquivar(status: StatusDocumentoSocietario): boolean {
  return status === 'finalizado';
}

export function podeFinalizar(status: StatusDocumentoSocietario): boolean {
  return status === 'rascunho';
}
