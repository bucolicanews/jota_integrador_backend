export interface CustoConsultaSerpro {
  idSistema: string;
  custoReais: number;
  precoVendaReais: number | null;
  atualizadoEm: string;
}

export interface CustosConsultasSerproRepositorioPort {
  listar(): Promise<CustoConsultaSerpro[]>;
  /** Upsert -- idSistema é a chave, não existe "criar duplicado". precoVendaReais omitido preserva o valor já cadastrado. */
  definir(idSistema: string, custoReais: number, precoVendaReais?: number): Promise<CustoConsultaSerpro>;
  remover(idSistema: string): Promise<void>;
}

export const CUSTOS_CONSULTAS_SERPRO_REPOSITORIO = Symbol('CUSTOS_CONSULTAS_SERPRO_REPOSITORIO');
