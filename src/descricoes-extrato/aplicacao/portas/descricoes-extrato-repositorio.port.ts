export interface DescricaoExtrato {
  id: string;
  empresaId: string;
  descricao: string;
}

export interface DadosDescricaoExtrato {
  empresaId: string;
  descricao: string;
}

export interface DescricoesExtratoRepositorioPort {
  criar(dados: DadosDescricaoExtrato): Promise<DescricaoExtrato>;
  listarPorEmpresa(empresaId: string): Promise<DescricaoExtrato[]>;
  obterPorId(id: string): Promise<DescricaoExtrato | null>;
  atualizar(id: string, dados: Partial<DadosDescricaoExtrato>): Promise<void>;
  excluir(id: string): Promise<void>;
}

export const DESCRICOES_EXTRATO_REPOSITORIO = Symbol('DESCRICOES_EXTRATO_REPOSITORIO');
