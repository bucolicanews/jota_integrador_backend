export interface CustoConsultaSerpro {
  idSistema: string;
  custoReais: number;
  atualizadoEm: string;
}

export interface CustosConsultasSerproRepositorioPort {
  listar(): Promise<CustoConsultaSerpro[]>;
  /** Upsert -- idSistema é a chave, não existe "criar duplicado". */
  definir(idSistema: string, custoReais: number): Promise<CustoConsultaSerpro>;
  remover(idSistema: string): Promise<void>;
}

export const CUSTOS_CONSULTAS_SERPRO_REPOSITORIO = Symbol('CUSTOS_CONSULTAS_SERPRO_REPOSITORIO');
