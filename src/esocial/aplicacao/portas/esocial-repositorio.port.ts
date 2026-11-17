export interface ConfiguracaoLancamentosEsocial {
  empresaId: string;
  contaDespesaSalarioId: string;
  contaDespesaProLaboreId: string;
  contaDespesaInssId: string;
  contaPassivoInssId: string;
  contaPassivoSalarioAPagarId: string;
  contaPassivoProLaboreAPagarId: string;
  contaDespesaFgtsId: string | null;
  contaPassivoFgtsId: string | null;
}

export interface DadosSalvarConfiguracaoLancamentosEsocial {
  empresaId: string;
  contaDespesaSalarioId: string;
  contaDespesaProLaboreId: string;
  contaDespesaInssId: string;
  contaPassivoInssId: string;
  contaPassivoSalarioAPagarId: string;
  contaPassivoProLaboreAPagarId: string;
  contaDespesaFgtsId: string | null;
  contaPassivoFgtsId: string | null;
  atualizadoPor: string;
}

export interface EsocialRepositorioPort {
  buscarConfiguracaoLancamentos(empresaId: string): Promise<ConfiguracaoLancamentosEsocial | null>;
  salvarConfiguracaoLancamentos(dados: DadosSalvarConfiguracaoLancamentosEsocial): Promise<void>;
}

export const ESOCIAL_REPOSITORIO = Symbol('ESOCIAL_REPOSITORIO');
