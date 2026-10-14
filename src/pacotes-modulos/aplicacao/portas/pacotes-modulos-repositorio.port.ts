export type Periodicidade = 'mensal' | 'anual';

export interface PacoteModulos {
  id: string;
  nome: string;
  descricao: string | null;
  modulos: string[];
  preco: number;
  periodicidade: Periodicidade;
  dataValidade: string | null;
  gratuito: boolean;
  ativo: boolean;
}

export interface DadosPacoteModulos {
  nome: string;
  descricao: string | null;
  modulos: string[];
  preco: number;
  periodicidade: Periodicidade;
  dataValidade: string | null;
  gratuito: boolean;
}

export interface PacotesModulosRepositorioPort {
  criar(dados: DadosPacoteModulos): Promise<PacoteModulos>;
  listar(apenasAtivos?: boolean): Promise<PacoteModulos[]>;
  obterPorId(id: string): Promise<PacoteModulos | null>;
  atualizar(id: string, dados: Partial<DadosPacoteModulos>): Promise<void>;
  marcarAtivo(id: string, ativo: boolean): Promise<void>;
}

export const PACOTES_MODULOS_REPOSITORIO = Symbol('PACOTES_MODULOS_REPOSITORIO');
