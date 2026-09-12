export interface Banco {
  id: string;
  empresaId: string;
  nome: string;
  contaContabilId: string;
  ativo: boolean;
}

export interface DadosBanco {
  empresaId: string;
  nome: string;
  contaContabilId: string;
}

export interface BancosRepositorioPort {
  criar(dados: DadosBanco): Promise<Banco>;
  listarPorEmpresa(empresaId: string, apenasAtivos?: boolean): Promise<Banco[]>;
  obterPorId(id: string): Promise<Banco | null>;
  atualizar(id: string, dados: Partial<Pick<DadosBanco, 'nome' | 'contaContabilId'>>): Promise<void>;
  marcarAtivo(id: string, ativo: boolean): Promise<void>;
}

export const BANCOS_REPOSITORIO = Symbol('BANCOS_REPOSITORIO');
