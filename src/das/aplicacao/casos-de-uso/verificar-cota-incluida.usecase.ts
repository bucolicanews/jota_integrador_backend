import { Inject, Injectable } from '@nestjs/common';
import {
  PeriodoConsultaIncluida,
  PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO,
  PlanoConsultasIncluidasRepositorioPort,
} from '../../../planos/aplicacao/portas/plano-consultas-incluidas-repositorio.port';
import {
  CONSULTAS_SERPRO_REPOSITORIO,
  ConsultasSerproRepositorioPort,
} from '../../../serpro/aplicacao/portas/consultas-serpro-repositorio.port';

/** Início do período corrente (UTC) conforme a granularidade da cota -- semanal começa na segunda-feira ISO. */
function inicioDoPeriodo(periodo: PeriodoConsultaIncluida): Date {
  const agora = new Date();
  const ano = agora.getUTCFullYear();

  switch (periodo) {
    case 'semanal': {
      const diaSemanaIso = agora.getUTCDay() === 0 ? 7 : agora.getUTCDay(); // 1 (segunda) .. 7 (domingo)
      const inicioSegunda = new Date(Date.UTC(ano, agora.getUTCMonth(), agora.getUTCDate() - (diaSemanaIso - 1)));
      return inicioSegunda;
    }
    case 'trimestral': {
      const inicioTrimestre = Math.floor(agora.getUTCMonth() / 3) * 3;
      return new Date(Date.UTC(ano, inicioTrimestre, 1));
    }
    case 'anual':
      return new Date(Date.UTC(ano, 0, 1));
    case 'mensal':
    default:
      return new Date(Date.UTC(ano, agora.getUTCMonth(), 1));
  }
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
    if (!cota) {
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
