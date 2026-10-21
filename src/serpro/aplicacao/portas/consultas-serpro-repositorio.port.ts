export interface DadosNovaConsultaSerpro {
  contadorId: string;
  empresaId: string;
  idSistema: string;
  idServico: string;
  sucesso: boolean;
  codigoErro: string | null;
  creditosConsumidos: number;
}

/** Log imutável de toda chamada ao SERPRO (docs/BANCO_DE_DADOS.md §4) -- nunca payload bruto. */
export interface ConsultasSerproRepositorioPort {
  registrar(dados: DadosNovaConsultaSerpro): Promise<void>;
  /** Conta chamadas bem-sucedidas de um id_sistema pra uma empresa desde `desde` (início do período corrente) -- usado pra checar cota incluída no plano. */
  contarSucessoNoPeriodo(empresaId: string, idSistema: string, desde: Date): Promise<number>;
}

export const CONSULTAS_SERPRO_REPOSITORIO = Symbol('CONSULTAS_SERPRO_REPOSITORIO');
