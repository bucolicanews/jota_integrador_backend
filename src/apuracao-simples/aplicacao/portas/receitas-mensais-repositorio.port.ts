import { ReceitaMensal, TipoAtividadeReceita } from '../../dominio/receita-mensal';

export interface DadosDefinirReceitaMensal {
  empresaId: string;
  competencia: string;
  tipoAtividade: TipoAtividadeReceita;
  valor: number;
  criadoPor: string;
  issRetidoNaFonte?: boolean;
  issDevidoAOutroMunicipio?: boolean;
}

export interface ReceitasMensaisRepositorioPort {
  /** Upsert por (empresaId, competencia, tipoAtividade) -- sempre origem='manual' (único jeito de escrever aqui é o contador digitando). */
  definir(dados: DadosDefinirReceitaMensal): Promise<ReceitaMensal>;
  /** Intervalo inclusive, qualquer tipoAtividade. */
  listarPorPeriodo(empresaId: string, competenciaInicio: string, competenciaFim: string): Promise<ReceitaMensal[]>;
}

export const RECEITAS_MENSAIS_REPOSITORIO = Symbol('RECEITAS_MENSAIS_REPOSITORIO');
