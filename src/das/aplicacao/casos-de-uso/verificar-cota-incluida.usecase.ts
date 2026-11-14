import { Inject, Injectable } from '@nestjs/common';
import {
  ConsultaIncluidaPlano,
  PeriodoConsultaIncluida,
  PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO,
  PlanoConsultasIncluidasRepositorioPort,
} from '../../../planos/aplicacao/portas/plano-consultas-incluidas-repositorio.port';
import {
  CONSULTAS_SERPRO_REPOSITORIO,
  ConsultasSerproRepositorioPort,
} from '../../../serpro/aplicacao/portas/consultas-serpro-repositorio.port';

const MESES_POR_CICLO: Record<PeriodoConsultaIncluida, number | null> = {
  semanal: null,
  mensal: null,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/**
 * Início do período corrente (UTC) conforme a granularidade da cota -- semanal começa na
 * segunda-feira ISO. Exportada -- reusada por EstimarSincronizacaoDasUseCase (mesma conta
 * de "quanto já foi usado nesse período", sem duplicar a regra de data).
 */
export function inicioDoPeriodo(periodo: PeriodoConsultaIncluida): Date {
  const agora = new Date();
  const ano = agora.getUTCFullYear();
  const mesesPorCiclo = MESES_POR_CICLO[periodo];

  if (periodo === 'semanal') {
    const diaSemanaIso = agora.getUTCDay() === 0 ? 7 : agora.getUTCDay(); // 1 (segunda) .. 7 (domingo)
    return new Date(Date.UTC(ano, agora.getUTCMonth(), agora.getUTCDate() - (diaSemanaIso - 1)));
  }
  if (!mesesPorCiclo) {
    return new Date(Date.UTC(ano, agora.getUTCMonth(), 1)); // mensal
  }
  const inicioCiclo = Math.floor(agora.getUTCMonth() / mesesPorCiclo) * mesesPorCiclo;
  return new Date(Date.UTC(ano, inicioCiclo, 1));
}

/**
 * true = hoje é o dia configurado pra essa cota disparar -- enforcement real pedido pelo
 * usuário (antes a cota só olhava quantidade usada no período, e na prática sempre caía no
 * dia 1 porque o cron é diário). Semanal nunca teve campo de dia -- sempre elegível, mesmo
 * comportamento reativo de antes.
 */
export function hojeEhDiaDaCota(cota: Pick<ConsultaIncluidaPlano, 'periodo' | 'diaDoMes' | 'mesDoPeriodo'>): boolean {
  if (cota.periodo === 'semanal') {
    return true;
  }
  const agora = new Date();
  const mes = agora.getUTCMonth(); // 0-11
  const ultimoDiaDoMes = new Date(Date.UTC(agora.getUTCFullYear(), mes + 1, 0)).getUTCDate();
  const diaEsperado = Math.min(cota.diaDoMes ?? 1, ultimoDiaDoMes);
  if (agora.getUTCDate() !== diaEsperado) {
    return false;
  }
  const mesesPorCiclo = MESES_POR_CICLO[cota.periodo];
  if (!mesesPorCiclo) {
    return true; // mensal -- só o dia importa
  }
  const posicaoNoCiclo = (mes % mesesPorCiclo) + 1;
  return posicaoNoCiclo === (cota.mesDoPeriodo ?? 1);
}

@Injectable()
export class VerificarCotaIncluidaUseCase {
  constructor(
    @Inject(PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO)
    private readonly consultasIncluidasRepositorio: PlanoConsultasIncluidasRepositorioPort,
    @Inject(CONSULTAS_SERPRO_REPOSITORIO) private readonly consultasSerproRepositorio: ConsultasSerproRepositorioPort,
  ) {}

  /** true = esta chamada ainda cabe na cota incluída do plano (não deve debitar crédito). */
  async executar(empresaId: string, planoId: string | null, idSistema: string): Promise<boolean> {
    if (!planoId) {
      return false;
    }
    const cota = await this.consultasIncluidasRepositorio.buscar(planoId, idSistema);
    if (!cota || !hojeEhDiaDaCota(cota)) {
      return false;
    }
    const usoNoPeriodo = await this.consultasSerproRepositorio.contarSucessoNoPeriodo(
      empresaId,
      idSistema,
      inicioDoPeriodo(cota.periodo),
    );
    return usoNoPeriodo < cota.quantidadePorPeriodo;
  }
}
