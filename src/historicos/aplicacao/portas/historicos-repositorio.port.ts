export interface Historico {
  id: string;
  empresaId: string;
  codigo: string | null;
  descricao: string;
}

export interface DadosHistorico {
  empresaId: string;
  codigo?: string | null;
  descricao: string;
}

export interface HistoricosRepositorioPort {
  criar(dados: DadosHistorico): Promise<Historico>;
  listarPorEmpresa(empresaId: string): Promise<Historico[]>;
  obterPorId(id: string): Promise<Historico | null>;
  atualizar(id: string, dados: Partial<DadosHistorico>): Promise<void>;
  excluir(id: string): Promise<void>;
}

export const HISTORICOS_REPOSITORIO = Symbol('HISTORICOS_REPOSITORIO');
