export type PeriodoConsultaIncluida = 'semanal' | 'mensal' | 'trimestral' | 'anual';

export interface ConsultaIncluidaPlano {
  id: string;
  planoId: string;
  idSistema: string;
  quantidadePorPeriodo: number;
  periodo: PeriodoConsultaIncluida;
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
  ): Promise<ConsultaIncluidaPlano>;
  remover(planoId: string, idSistema: string): Promise<void>;
}

export const PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO = Symbol('PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO');
