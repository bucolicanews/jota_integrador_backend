export interface PlanoRevendaCredito {
  id: string;
  contadorId: string;
  planoId: string;
  nome: string | null;
  valorVenda: number;
  ativo: boolean;
}

export interface DadosNovoPlanoRevendaCredito {
  contadorId: string;
  planoId: string;
  nome: string | null;
  valorVenda: number;
}

export interface DadosAtualizacaoPlanoRevendaCredito {
  nome?: string | null;
  valorVenda?: number;
  ativo?: boolean;
}

export interface PlanosRevendaCreditosRepositorioPort {
  criar(dados: DadosNovoPlanoRevendaCredito): Promise<PlanoRevendaCredito>;
  listarPorContador(contadorId: string): Promise<PlanoRevendaCredito[]>;
  obterPorId(id: string): Promise<PlanoRevendaCredito | null>;
  /** O plano ativo do contador pra um plano de créditos -- usado na hora de iniciar um pagamento de assinatura. */
  obterAtivoPorContadorEPlano(contadorId: string, planoId: string): Promise<PlanoRevendaCredito | null>;
  atualizar(id: string, dados: DadosAtualizacaoPlanoRevendaCredito): Promise<void>;
}

export const PLANOS_REVENDA_CREDITOS_REPOSITORIO = Symbol('PLANOS_REVENDA_CREDITOS_REPOSITORIO');
