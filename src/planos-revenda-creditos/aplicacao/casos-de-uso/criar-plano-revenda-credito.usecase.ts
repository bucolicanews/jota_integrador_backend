import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PLANOS_REPOSITORIO, PlanosRepositorioPort } from '../../../planos/aplicacao/portas/planos-repositorio.port';
import { validarMargem } from '../../dominio/plano-revenda-credito';
import {
  DadosNovoPlanoRevendaCredito,
  PLANOS_REVENDA_CREDITOS_REPOSITORIO,
  PlanoRevendaCredito,
  PlanosRevendaCreditosRepositorioPort,
} from '../portas/planos-revenda-creditos-repositorio.port';

@Injectable()
export class CriarPlanoRevendaCreditoUseCase {
  constructor(
    @Inject(PLANOS_REVENDA_CREDITOS_REPOSITORIO) private readonly repositorio: PlanosRevendaCreditosRepositorioPort,
    @Inject(PLANOS_REPOSITORIO) private readonly planosRepositorio: PlanosRepositorioPort,
  ) {}

  async executar(dados: DadosNovoPlanoRevendaCredito): Promise<PlanoRevendaCredito> {
    const plano = await this.planosRepositorio.buscarPorId(dados.planoId);
    if (!plano) {
      throw new NotFoundException('Plano não encontrado');
    }
    try {
      validarMargem(dados.valorVenda, plano.preco);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }
    return this.repositorio.criar(dados);
  }
}
