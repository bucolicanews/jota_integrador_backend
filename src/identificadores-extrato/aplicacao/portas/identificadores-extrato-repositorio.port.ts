export interface IdentificadorExtrato {
  id: string;
  empresaId: string;
  descricao: string;
}

export interface DadosIdentificadorExtrato {
  empresaId: string;
  descricao: string;
}

export interface IdentificadoresExtratoRepositorioPort {
  criar(dados: DadosIdentificadorExtrato): Promise<IdentificadorExtrato>;
  listarPorEmpresa(empresaId: string): Promise<IdentificadorExtrato[]>;
  obterPorId(id: string): Promise<IdentificadorExtrato | null>;
  atualizar(id: string, dados: Partial<DadosIdentificadorExtrato>): Promise<void>;
  excluir(id: string): Promise<void>;
}

export const IDENTIFICADORES_EXTRATO_REPOSITORIO = Symbol('IDENTIFICADORES_EXTRATO_REPOSITORIO');
