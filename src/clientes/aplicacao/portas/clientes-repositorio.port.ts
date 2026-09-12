export interface Cliente {
  id: string;
  empresaId: string;
  nome: string;
  razaoSocial: string | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  ativo: boolean;
}

export interface DadosCliente {
  empresaId: string;
  nome: string;
  razaoSocial?: string | null;
  documento?: string | null;
  email?: string | null;
  telefone?: string | null;
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

export interface ClientesRepositorioPort {
  criar(dados: DadosCliente): Promise<Cliente>;
  listarPorEmpresa(empresaId: string, apenasAtivos?: boolean): Promise<Cliente[]>;
  obterPorId(id: string): Promise<Cliente | null>;
  atualizar(id: string, dados: Partial<DadosCliente>): Promise<void>;
  marcarAtivo(id: string, ativo: boolean): Promise<void>;
}

export const CLIENTES_REPOSITORIO = Symbol('CLIENTES_REPOSITORIO');
