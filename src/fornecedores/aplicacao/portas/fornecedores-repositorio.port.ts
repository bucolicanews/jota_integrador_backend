export interface Fornecedor {
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

export interface DadosFornecedor {
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

export interface FornecedoresRepositorioPort {
  criar(dados: DadosFornecedor): Promise<Fornecedor>;
  listarPorEmpresa(empresaId: string, apenasAtivos?: boolean): Promise<Fornecedor[]>;
  obterPorId(id: string): Promise<Fornecedor | null>;
  atualizar(id: string, dados: Partial<DadosFornecedor>): Promise<void>;
  marcarAtivo(id: string, ativo: boolean): Promise<void>;
}

export const FORNECEDORES_REPOSITORIO = Symbol('FORNECEDORES_REPOSITORIO');
