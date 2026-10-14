export interface FiltroRelatorioConsultas {
  contadorId?: string;
  empresaId?: string;
  idSistema?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface LinhaRelatorioConsultas {
  idSistema: string;
  contadorId: string;
  empresaId: string;
  totalConsultas: number;
  totalSucesso: number;
  custoTotalReais: number;
}

export interface RelatorioConsultasSerproRepositorioPort {
  agregarPorFiltro(filtro: FiltroRelatorioConsultas): Promise<LinhaRelatorioConsultas[]>;
}

export const RELATORIO_CONSULTAS_SERPRO_REPOSITORIO = Symbol('RELATORIO_CONSULTAS_SERPRO_REPOSITORIO');
