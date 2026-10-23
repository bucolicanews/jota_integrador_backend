import { StatusAssinatura } from '../../dominio/assinatura';

export interface Assinatura {
  id: string;
  contadorId: string;
  empresaId: string;
  planoId: string;
  planoRevendaId: string | null;
  status: StatusAssinatura;
  inicioEm: string;
  fimEm: string | null;
}

export interface DadosNovaAssinatura {
  contadorId: string;
  empresaId: string;
  planoId: string;
  planoRevendaId: string | null;
}

export interface DadosAtualizacaoAssinatura {
  planoId?: string;
  planoRevendaId?: string | null;
}

export interface AssinaturasRepositorioPort {
  /** A assinatura corrente da empresa (qualquer status != cancelada -- índice único garante só 1). Null = empresa nunca teve/já cancelou. */
  buscarPorEmpresa(empresaId: string): Promise<Assinatura | null>;
  /** Só status='ativa' -- usado pelo gate de acesso ao SERPRO (bloqueada/cancelada não passa). */
  buscarAtivaPorEmpresa(empresaId: string): Promise<Assinatura | null>;
  criar(dados: DadosNovaAssinatura): Promise<Assinatura>;
  atualizar(id: string, dados: DadosAtualizacaoAssinatura): Promise<void>;
  atualizarStatus(id: string, status: StatusAssinatura): Promise<void>;
  /** "Válido até" do ciclo pago atual -- empurrado a cada pagamento confirmado (ativação ou renovação), ver proximoFimPeriodo. */
  atualizarFimEm(id: string, fimEm: string): Promise<void>;
}

export const ASSINATURAS_REPOSITORIO = Symbol('ASSINATURAS_REPOSITORIO');
