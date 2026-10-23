import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { validarMargem } from '../../dominio/plano-revenda-credito-avulso';
import {
  DadosAtualizacaoPlanoRevendaCreditoAvulso,
  PLANOS_REVENDA_CREDITOS_AVULSOS_REPOSITORIO,
  PlanosRevendaCreditosAvulsosRepositorioPort,
} from '../portas/planos-revenda-creditos-avulsos-repositorio.port';

@Injectable()
export class AtualizarPlanoRevendaCreditoAvulsoUseCase {
  constructor(
    @Inject(PLANOS_REVENDA_CREDITOS_AVULSOS_REPOSITORIO) private readonly repositorio: PlanosRevendaCreditosAvulsosRepositorioPort,
  ) {}

  async executar(id: string, dados: DadosAtualizacaoPlanoRevendaCreditoAvulso): Promise<void> {
    const plano = await this.repositorio.obterPorId(id);
    if (!plano) {
      throw new NotFoundException('Plano de revenda não encontrado');
    }

    if (dados.valorVenda !== undefined) {
      const precoPacote = await this.repositorio.obterPrecoPacote(plano.pacoteId);
      if (precoPacote === null) {
        throw new NotFoundException('Pacote de crédito avulso não encontrado');
      }
      try {
        validarMargem(dados.valorVenda, precoPacote);
      } catch (erro) {
        throw new BadRequestException((erro as Error).message);
      }
    }

    await this.repositorio.atualizar(id, dados);
  }
}
