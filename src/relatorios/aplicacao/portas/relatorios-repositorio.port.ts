export interface SaldoContaPeriodo {
  contaId: string;
  saldoInicial: number;
  totalDebito: number;
  totalCredito: number;
  saldoFinal: number;
}

export interface MovimentoConta {
  contaId: string;
  lancamentoId: string;
  dataCompetencia: string;
  historico: string;
  origem: string;
  tipo: 'debito' | 'credito';
  valor: number;
}

export interface RelatoriosRepositorioPort {
  /** p_data_inicio null = "desde sempre" (saldo inicial vira 0). */
  obterSaldosPeriodo(empresaId: string, dataInicio: string | null, dataFim: string): Promise<SaldoContaPeriodo[]>;
  obterMovimentosPeriodo(empresaId: string, dataInicio: string, dataFim: string, contaId?: string): Promise<MovimentoConta[]>;
}

export const RELATORIOS_REPOSITORIO = Symbol('RELATORIOS_REPOSITORIO');
