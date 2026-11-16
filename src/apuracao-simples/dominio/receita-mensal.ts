export type TipoAtividadeReceita = 'comercio_industria' | 'servico';
export type OrigemReceitaMensal = 'notas_fiscais' | 'manual';

export interface ReceitaMensal {
  id: string;
  empresaId: string;
  /** AAAA-MM-01 */
  competencia: string;
  tipoAtividade: TipoAtividadeReceita;
  valor: number;
  origem: OrigemReceitaMensal;
  /** Só relevante pra tipoAtividade='servico' -- precisa pra escolher o idAtividade certo na transmissão do PGDAS-D (ver src/das/dominio/id-atividade-pgdasd.ts). */
  issRetidoNaFonte: boolean;
  /** Só relevante quando issRetidoNaFonte=false -- ISS devido ao município do tomador em vez do estabelecimento. */
  issDevidoAOutroMunicipio: boolean;
}

/**
 * Lista de competências (AAAA-MM-01) nos `quantidade` meses ANTERIORES a
 * `competenciaReferencia` (exclusive -- RBT12 nunca inclui o próprio mês de apuração),
 * mais antiga primeiro. Mesmo estilo de `janelaPadraoCompetencias`/`competenciasNoIntervalo`
 * em src/das/dominio/das.ts, só que retroativo a partir de uma competência escolhida em vez
 * de "hoje".
 */
export function mesesAnteriores(competenciaReferencia: string, quantidade: number): string[] {
  const [ano, mes] = competenciaReferencia.split('-').map(Number);
  const competencias: string[] = [];
  for (let i = quantidade; i >= 1; i--) {
    const data = new Date(Date.UTC(ano, mes - 1 - i, 1));
    competencias.push(data.toISOString().slice(0, 10));
  }
  return competencias;
}

/** Último dia do mês de `competencia` (AAAA-MM-01) -- usado como limite superior ao buscar notas fiscais daquele mês. */
export function ultimoDiaDoMes(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number);
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
}
