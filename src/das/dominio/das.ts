// DAS (Documento de Arrecadação do Simples Nacional/MEI) -- docs/BANCO_DE_DADOS.md.
//
// Dois regimes, dois caminhos SERPRO completamente diferentes (nunca misturar a
// lógica dos dois num branch genérico):
// - MEI (PGMEI/GERARDASPDF21): DAS autocontido, gerado direto por período, sem
//   depender de nenhuma declaração prévia. Tabela própria `das_mei`.
// - Simples Nacional ME/EPP (PGDASD): DAS só existe depois de uma declaração já
//   transmitida (fora do escopo deste módulo -- lida aqui como fato consumado via
//   CONSDECLARACAO13/CONSEXTRATO16). Tabela `declaracoes_pgdas` (já existia como
//   esqueleto da Fase 3).

export type RegimeDas = 'mei' | 'simples_nacional';

export type StatusDas = 'pendente' | 'pago';

/** Status "vencido" nunca é armazenado -- é sempre calculado em cima de status+vencimento. */
export type StatusApresentacaoDas = 'pendente' | 'pago' | 'vencido';

export interface DasItem {
  id: string;
  empresaId: string;
  regime: RegimeDas;
  /** Primeiro dia do mês de competência (AAAA-MM-01). */
  competencia: string;
  /** NULL quando o SERPRO não devolveu valor estruturado nesta sincronização (ver comentário da migration 20261020000002) -- o PDF tem o valor impresso. */
  valor: number | null;
  vencimento: string;
  status: StatusDas;
  numeroDocumento: string | null;
  pdfStorageRef: string | null;
  pagoEm: string | null;
}

/** `hoje` injetado (nunca `new Date()` direto dentro da função) -- deixa a regra testável sem mockar relógio. */
export function statusApresentacao(item: Pick<DasItem, 'status' | 'vencimento'>, hoje: Date): StatusApresentacaoDas {
  if (item.status === 'pago') return 'pago';
  const vencimento = new Date(`${item.vencimento}T00:00:00`);
  return vencimento < hoje ? 'vencido' : 'pendente';
}

/** AAAAMM pro envelope SERPRO (PGMEI periodoApuracao, PGDASD declarações) a partir da data de competência. */
export function competenciaParaAAAAMM(competencia: string): string {
  const [ano, mes] = competencia.split('-');
  return `${ano}${mes}`;
}

/**
 * Nenhum serviço SERPRO confirmado até agora devolve a data de vencimento estruturada
 * (CONSEXTRATO16 só traz {numeroDas, extrato:{nomeArquivo,pdf}} -- confirmado contra o
 * trial). Regra legal conhecida do DAS (MEI e Simples Nacional): vence todo dia 20 do
 * mês seguinte à competência -- usado como aproximação até confirmar contra produção se
 * algum serviço expõe o valor real (feriado/fim de semana antecipa, não tratado aqui).
 */
export function vencimentoPadrao(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number);
  const data = new Date(ano, mes, 20); // mes já é 1-indexed na string AAAA-MM -> vira o mês seguinte em Date (0-indexed)
  return data.toISOString().slice(0, 10);
}
