export interface PlanoRevendaCreditoAvulso {
  id: string;
  contadorId: string;
  pacoteId: string;
  nome: string | null;
  valorVenda: number;
  ativo: boolean;
}

export interface DadosNovoPlanoRevendaCreditoAvulso {
  contadorId: string;
  pacoteId: string;
  nome: string | null;
  valorVenda: number;
}

export interface DadosAtualizacaoPlanoRevendaCreditoAvulso {
  nome?: string | null;
  valorVenda?: number;
  ativo?: boolean;
}

export interface PlanosRevendaCreditosAvulsosRepositorioPort {
  criar(dados: DadosNovoPlanoRevendaCreditoAvulso): Promise<PlanoRevendaCreditoAvulso>;
  listarPorContador(contadorId: string): Promise<PlanoRevendaCreditoAvulso[]>;
  obterPorId(id: string): Promise<PlanoRevendaCreditoAvulso | null>;
  atualizar(id: string, dados: DadosAtualizacaoPlanoRevendaCreditoAvulso): Promise<void>;
  /**
   * Consulta direta a pacotes_creditos_avulsos.preco_reais (sem passar pelo port/módulo
   * de creditos-avulsos) -- evita dependência circular de módulos (mesmo cuidado de
   * VerificarCotaIncluidaUseCase), já que creditos-avulsos importa este módulo pra
   * resolver a compra via revenda.
   */
  obterPrecoPacote(pacoteId: string): Promise<number | null>;
}

export const PLANOS_REVENDA_CREDITOS_AVULSOS_REPOSITORIO = Symbol('PLANOS_REVENDA_CREDITOS_AVULSOS_REPOSITORIO');
