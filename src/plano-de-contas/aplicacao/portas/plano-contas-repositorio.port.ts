import { GrupoContaContabil } from '../../dominio/plano-conta';

export interface PlanoConta {
  id: string;
  empresaId: string;
  codigo: string;
  nome: string;
  grupo: GrupoContaContabil;
  sintetica: boolean;
  contaPaiId: string | null;
  contaCaixaBanco: boolean;
  contaAReceber: boolean;
  contaAPagar: boolean;
  ativa: boolean;
}

export interface DadosNovaContaContabil {
  empresaId: string;
  codigo: string;
  nome: string;
  grupo: GrupoContaContabil;
  sintetica: boolean;
  contaPaiId: string | null;
  contaCaixaBanco: boolean;
  contaAReceber: boolean;
  contaAPagar: boolean;
}

export interface DadosAtualizacaoContaContabil {
  nome?: string;
  contaCaixaBanco?: boolean;
  contaAReceber?: boolean;
  contaAPagar?: boolean;
}

export interface LinhaImportacaoPlanoConta {
  codigo: string;
  nome: string;
  grupo: GrupoContaContabil;
  sintetica: boolean;
  codigoPai: string | null;
  contaCaixaBanco: boolean;
  contaAReceber: boolean;
  contaAPagar: boolean;
}

export interface ResultadoImportacaoPlanoContas {
  criadas: number;
  atualizadas: number;
  desativadas: number;
}

export interface PlanoContasRepositorioPort {
  criar(dados: DadosNovaContaContabil): Promise<PlanoConta>;
  buscarPorId(id: string): Promise<PlanoConta | null>;
  listarPorEmpresa(empresaId: string): Promise<PlanoConta[]>;
  atualizar(id: string, dados: DadosAtualizacaoContaContabil): Promise<void>;
  marcarAtiva(id: string, ativa: boolean): Promise<void>;
  /**
   * Upsert por (empresa_id, codigo) + desativa (nunca apaga) contas que não vieram no
   * lote -- `plano_contas` tem RLS `delete using (false)` de propósito (ver migration
   * 20260909000005): histórico de lançamentos aponta pra conta_id e não pode virar
   * referência quebrada.
   */
  importarLote(empresaId: string, linhas: LinhaImportacaoPlanoConta[]): Promise<ResultadoImportacaoPlanoContas>;
}

export const PLANO_CONTAS_REPOSITORIO = Symbol('PLANO_CONTAS_REPOSITORIO');
