export interface MovimentoCredito {
  id: string;
  contadorId: string;
  empresaId: string | null;
  tipoOperacao: string;
  quantidade: number; // assinado: negativo = débito, positivo = crédito
  saldoAntes: number;
  saldoDepois: number;
  motivo: string | null;
  criadoEm: string;
}

/** Erro específico pra saldo insuficiente -- controller/use case decide o status HTTP certo (402/403) a partir dele. */
export class SaldoInsuficienteError extends Error {}

export interface CreditosRepositorioPort {
  /** Saldo é por EMPRESA (não mais por contador) -- cada empresa-cliente tem o próprio plano/saldo. */
  obterSaldo(empresaId: string): Promise<number>;
  listarMovimentos(empresaId: string): Promise<MovimentoCredito[]>;
  /** Atômico via função Postgres (debitar_creditos) -- nunca implementar isso como UPDATE+INSERT separados. contadorId só vai pra auditoria em creditos_movimentos. */
  debitar(contadorId: string, empresaId: string, tipoOperacao: string, quantidade: number, motivo: string): Promise<number>;
  /** Atômico via função Postgres (creditar_creditos). tipoOperacao default 'AJUSTE_MANUAL' -- assinaturas/ usa 'RENOVACAO_ASSINATURA'. */
  creditar(contadorId: string, empresaId: string, quantidade: number, motivo: string, tipoOperacao?: string): Promise<number>;
}

export const CREDITOS_REPOSITORIO = Symbol('CREDITOS_REPOSITORIO');
