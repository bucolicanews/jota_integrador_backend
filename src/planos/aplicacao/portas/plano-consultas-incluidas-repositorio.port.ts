export type PeriodoConsultaIncluida = 'semanal' | 'mensal' | 'trimestral' | 'semestral' | 'anual';

export interface ConsultaIncluidaPlano {
  id: string;
  planoId: string;
  idSistema: string;
  quantidadePorPeriodo: number;
  periodo: PeriodoConsultaIncluida;
  /** Dia do mês (1-31) em que a cota fica disponível -- null só quando periodo=semanal. */
  diaDoMes: number | null;
  /** Mês do ciclo (trimestral 1-3, semestral 1-6, anual 1-12) -- null pra mensal/semanal. */
  mesDoPeriodo: number | null;
}

export interface PlanoConsultasIncluidasRepositorioPort {
  listarPorPlano(planoId: string): Promise<ConsultaIncluidaPlano[]>;
  /** Busca a cota de um id_sistema específico dentro de um plano -- null se o plano não cobre esse sistema. */
  buscar(planoId: string, idSistema: string): Promise<ConsultaIncluidaPlano | null>;
  /** Upsert -- (planoId, idSistema) é a chave composta. */
  definir(
    planoId: string,
    idSistema: string,
    quantidadePorPeriodo: number,
    periodo: PeriodoConsultaIncluida,
    diaDoMes: number | null,
    mesDoPeriodo: number | null,
  ): Promise<ConsultaIncluidaPlano>;
  remover(planoId: string, idSistema: string): Promise<void>;
}

export const PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO = Symbol('PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO');
