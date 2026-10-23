export interface ConfiguracaoCreditosAvulsos {
  valorPorCredito: number;
}

export interface ConfiguracaoCreditosAvulsosRepositorioPort {
  obter(): Promise<ConfiguracaoCreditosAvulsos>;
  definirValorPorCredito(valorPorCredito: number): Promise<void>;
}

export const CONFIGURACAO_CREDITOS_AVULSOS_REPOSITORIO = Symbol('CONFIGURACAO_CREDITOS_AVULSOS_REPOSITORIO');
