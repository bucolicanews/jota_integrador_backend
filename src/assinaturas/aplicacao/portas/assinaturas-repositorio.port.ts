import { StatusAssinatura } from '../../dominio/assinatura';

export interface Assinatura {
  id: string;
  contadorId: string;
  empresaId: string;
  planoId: string;
  /** Nome do plano (join por planoId) -- sempre presente, diferente de planoRevendaId (null quando ativado sem catálogo de revenda, ex: "Ativar sem cobrar" do admin). */
  planoNome: string | null;
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
  /** status='ativa' E (fim_em nulo OU ainda não passou) -- usado pelo gate de acesso ao SERPRO (vencida/bloqueada/cancelada não passa). Checagem por data em tempo real, não depende do cron ter rodado. */
  buscarAtivaPorEmpresa(empresaId: string): Promise<Assinatura | null>;
  criar(dados: DadosNovaAssinatura): Promise<Assinatura>;
  atualizar(id: string, dados: DadosAtualizacaoAssinatura): Promise<void>;
  atualizarStatus(id: string, status: StatusAssinatura): Promise<void>;
  /** "Válido até" do ciclo pago atual -- empurrado a cada pagamento confirmado (ativação ou renovação), ver proximoFimPeriodo. */
  atualizarFimEm(id: string, fimEm: string | null): Promise<void>;
  /** Vira 'vencida' toda assinatura 'ativa' cujo fim_em já passou -- cron (AssinaturasVencimentoCron). Retorna quantas mudaram. */
  marcarVencidas(): Promise<number>;
}

export const ASSINATURAS_REPOSITORIO = Symbol('ASSINATURAS_REPOSITORIO');
