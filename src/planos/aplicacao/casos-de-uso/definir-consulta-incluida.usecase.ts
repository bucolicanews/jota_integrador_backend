import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ConsultaIncluidaPlano,
  PeriodoConsultaIncluida,
  PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO,
  PlanoConsultasIncluidasRepositorioPort,
} from '../portas/plano-consultas-incluidas-repositorio.port';
import { PLANOS_REPOSITORIO, PlanosRepositorioPort } from '../portas/planos-repositorio.port';

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
  ): Promise<ConsultaIncluidaPlano> {
    const plano = await this.planosRepositorio.buscarPorId(planoId);
    if (!plano) {
      throw new NotFoundException('Plano não encontrado');
    }
    if (quantidadePorPeriodo <= 0) {
      throw new BadRequestException('quantidadePorPeriodo precisa ser maior que zero');
    }
    return this.repositorio.definir(planoId, idSistema.trim().toUpperCase(), quantidadePorPeriodo, periodo);
  }
}
