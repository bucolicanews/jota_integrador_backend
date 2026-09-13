export type StatusFerias = 'agendada' | 'concluida' | 'cancelada';

export interface FeriasPonto {
  id: string;
  usuarioId: string;
  contadorId: string | null;
  empresaId: string | null;
  dataInicio: string;
  dataFim: string;
  periodoReferencia: string | null;
  status: StatusFerias;
  criadoPor: string;
  criadoEm: string;
}

export interface DadosNovasFerias {
  usuarioId: string;
  contadorId: string | null;
  empresaId: string | null;
  dataInicio: string;
  dataFim: string;
  periodoReferencia: string | null;
  criadoPor: string;
}

export interface FeriasPontoRepositorioPort {
  criar(dados: DadosNovasFerias): Promise<FeriasPonto>;
  listarPorUsuario(usuarioId: string): Promise<FeriasPonto[]>;
  /** Períodos que tocam o intervalo [inicio, fim) -- usado pra excluir dias de férias do cálculo do resumo mensal. */
  listarPorUsuarioNoIntervalo(usuarioId: string, inicio: string, fim: string): Promise<FeriasPonto[]>;
  obterPorId(id: string): Promise<FeriasPonto | null>;
  atualizarStatus(id: string, status: StatusFerias): Promise<void>;
}

export const FERIAS_PONTO_REPOSITORIO = Symbol('FERIAS_PONTO_REPOSITORIO');
