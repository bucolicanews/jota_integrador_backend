export interface PlanoRevendaPacote {
  id: string;
  contadorId: string;
  pacoteId: string;
  nome: string | null;
  valorVenda: number;
  ativo: boolean;
}

export interface DadosNovoPlanoRevenda {
  contadorId: string;
  pacoteId: string;
  nome: string | null;
  valorVenda: number;
}

export interface DadosAtualizacaoPlanoRevenda {
  nome?: string | null;
  valorVenda?: number;
  ativo?: boolean;
}

export interface PlanosRevendaPacoteRepositorioPort {
  criar(dados: DadosNovoPlanoRevenda): Promise<PlanoRevendaPacote>;
  listarPorContador(contadorId: string): Promise<PlanoRevendaPacote[]>;
  obterPorId(id: string): Promise<PlanoRevendaPacote | null>;
  /** O plano ativo do contador pra um pacote -- usado na hora de iniciar um pagamento de ativação. */
  obterAtivoPorContadorEPacote(contadorId: string, pacoteId: string): Promise<PlanoRevendaPacote | null>;
  atualizar(id: string, dados: DadosAtualizacaoPlanoRevenda): Promise<void>;
}

export const PLANOS_REVENDA_PACOTE_REPOSITORIO = Symbol('PLANOS_REVENDA_PACOTE_REPOSITORIO');
