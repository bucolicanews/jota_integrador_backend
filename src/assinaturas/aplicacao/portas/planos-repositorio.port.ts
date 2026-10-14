import { Periodicidade } from '../../dominio/plano';

export interface Plano {
  id: string;
  nome: string;
  descricao: string | null;
  operacoesIncluidas: number;
  modulos: string[];
  preco: number;
  periodicidade: Periodicidade;
  dataValidade: string | null;
  gratuito: boolean;
  ativo: boolean;
}

export interface DadosNovoPlano {
  nome: string;
  descricao: string | null;
  operacoesIncluidas: number;
  modulos: string[];
  preco: number;
  periodicidade: Periodicidade;
  dataValidade: string | null;
  gratuito: boolean;
}

export interface DadosAtualizacaoPlano {
  nome?: string;
  descricao?: string | null;
  operacoesIncluidas?: number;
  modulos?: string[];
  preco?: number;
  ativo?: boolean;
  dataValidade?: string | null;
  gratuito?: boolean;
}

export interface PlanosRepositorioPort {
  criar(dados: DadosNovoPlano): Promise<Plano>;
  buscarPorId(id: string): Promise<Plano | null>;
  /** `somenteAtivos=true` pro catálogo público -- contador não deve conseguir assinar um plano descontinuado. */
  listar(somenteAtivos: boolean): Promise<Plano[]>;
  atualizar(id: string, dados: DadosAtualizacaoPlano): Promise<Plano>;
}

export const PLANOS_REPOSITORIO = Symbol('PLANOS_REPOSITORIO');
