export interface PacoteCreditoAvulso {
  id: string;
  nome: string;
  quantidadeCreditos: number;
  precoReais: number;
  ativo: boolean;
}

export interface DadosNovoPacoteCreditoAvulso {
  nome: string;
  quantidadeCreditos: number;
  precoReais: number;
}

export interface DadosAtualizacaoPacoteCreditoAvulso {
  nome?: string;
  quantidadeCreditos?: number;
  precoReais?: number;
  ativo?: boolean;
}

export interface PacotesCreditosAvulsosRepositorioPort {
  criar(dados: DadosNovoPacoteCreditoAvulso): Promise<PacoteCreditoAvulso>;
  buscarPorId(id: string): Promise<PacoteCreditoAvulso | null>;
  /** `somenteAtivos=true` pro catálogo público -- empresa não deve conseguir comprar um pacote descontinuado. */
  listar(somenteAtivos: boolean): Promise<PacoteCreditoAvulso[]>;
  atualizar(id: string, dados: DadosAtualizacaoPacoteCreditoAvulso): Promise<PacoteCreditoAvulso>;
}

export const PACOTES_CREDITOS_AVULSOS_REPOSITORIO = Symbol('PACOTES_CREDITOS_AVULSOS_REPOSITORIO');
