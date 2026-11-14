import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ConsultaIncluidaPlano,
  PeriodoConsultaIncluida,
  PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO,
  PlanoConsultasIncluidasRepositorioPort,
} from '../portas/plano-consultas-incluidas-repositorio.port';
import { PLANOS_REPOSITORIO, PlanosRepositorioPort } from '../portas/planos-repositorio.port';

const MESES_MAXIMOS_POR_PERIODO: Record<PeriodoConsultaIncluida, number | null> = {
  semanal: null,
  mensal: null,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

@Injectable()
export class DefinirConsultaIncluidaUseCase {
  constructor(
    @Inject(PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO) private readonly repositorio: PlanoConsultasIncluidasRepositorioPort,
    @Inject(PLANOS_REPOSITORIO) private readonly planosRepositorio: PlanosRepositorioPort,
  ) {}

  async executar(
    planoId: string,
    idSistema: string,
    quantidadePorPeriodo: number,
    periodo: PeriodoConsultaIncluida = 'mensal',
    diaDoMes?: number,
    mesDoPeriodo?: number,
  ): Promise<ConsultaIncluidaPlano> {
    const plano = await this.planosRepositorio.buscarPorId(planoId);
    if (!plano) {
      throw new NotFoundException('Plano não encontrado');
    }
    if (quantidadePorPeriodo <= 0) {
      throw new BadRequestException('quantidadePorPeriodo precisa ser maior que zero');
    }

    const mesesMaximos = MESES_MAXIMOS_POR_PERIODO[periodo];

    if (periodo === 'semanal') {
      // Nunca teve campo de dia -- mantém o comportamento reativo de antes.
      return this.repositorio.definir(planoId, idSistema.trim().toUpperCase(), quantidadePorPeriodo, periodo, null, null);
    }

    if (diaDoMes === undefined) {
      throw new BadRequestException('diaDoMes é obrigatório pra esse período (dia em que a cota gratuita fica disponível)');
    }

    if (!mesesMaximos) {
      // mensal -- mesDoPeriodo não se aplica.
      return this.repositorio.definir(planoId, idSistema.trim().toUpperCase(), quantidadePorPeriodo, periodo, diaDoMes, null);
    }

    if (mesDoPeriodo === undefined || mesDoPeriodo < 1 || mesDoPeriodo > mesesMaximos) {
      throw new BadRequestException(`mesDoPeriodo é obrigatório pra periodo="${periodo}" e precisa estar entre 1 e ${mesesMaximos}`);
    }

    return this.repositorio.definir(planoId, idSistema.trim().toUpperCase(), quantidadePorPeriodo, periodo, diaDoMes, mesDoPeriodo);
  }
}
