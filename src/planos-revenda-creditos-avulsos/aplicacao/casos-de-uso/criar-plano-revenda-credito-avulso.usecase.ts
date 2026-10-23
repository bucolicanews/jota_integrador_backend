import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { validarMargem } from '../../dominio/plano-revenda-credito-avulso';
import {
  DadosNovoPlanoRevendaCreditoAvulso,
  PLANOS_REVENDA_CREDITOS_AVULSOS_REPOSITORIO,
  PlanoRevendaCreditoAvulso,
  PlanosRevendaCreditosAvulsosRepositorioPort,
} from '../portas/planos-revenda-creditos-avulsos-repositorio.port';

@Injectable()
export class CriarPlanoRevendaCreditoAvulsoUseCase {
  constructor(
    @Inject(PLANOS_REVENDA_CREDITOS_AVULSOS_REPOSITORIO) private readonly repositorio: PlanosRevendaCreditosAvulsosRepositorioPort,
  ) {}

  async executar(dados: DadosNovoPlanoRevendaCreditoAvulso): Promise<PlanoRevendaCreditoAvulso> {
    const precoPacote = await this.repositorio.obterPrecoPacote(dados.pacoteId);
    if (precoPacote === null) {
      throw new NotFoundException('Pacote de crédito avulso não encontrado');
    }
    try {
      validarMargem(dados.valorVenda, precoPacote);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }
    return this.repositorio.criar(dados);
  }
}
