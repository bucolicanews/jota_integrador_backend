import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PLANOS_REPOSITORIO, PlanosRepositorioPort } from '../../../planos/aplicacao/portas/planos-repositorio.port';
import { validarMargem } from '../../dominio/plano-revenda-credito';
import {
  DadosAtualizacaoPlanoRevendaCredito,
  PLANOS_REVENDA_CREDITOS_REPOSITORIO,
  PlanosRevendaCreditosRepositorioPort,
} from '../portas/planos-revenda-creditos-repositorio.port';

@Injectable()
export class AtualizarPlanoRevendaCreditoUseCase {
  constructor(
    @Inject(PLANOS_REVENDA_CREDITOS_REPOSITORIO) private readonly repositorio: PlanosRevendaCreditosRepositorioPort,
    @Inject(PLANOS_REPOSITORIO) private readonly planosRepositorio: PlanosRepositorioPort,
  ) {}

  async executar(id: string, dados: DadosAtualizacaoPlanoRevendaCredito): Promise<void> {
    const plano = await this.repositorio.obterPorId(id);
    if (!plano) {
      throw new NotFoundException('Plano de revenda não encontrado');
    }

    if (dados.valorVenda !== undefined) {
      const planoCredito = await this.planosRepositorio.buscarPorId(plano.planoId);
      if (!planoCredito) {
        throw new NotFoundException('Plano não encontrado');
      }
      try {
        validarMargem(dados.valorVenda, planoCredito.preco);
      } catch (erro) {
        throw new BadRequestException((erro as Error).message);
      }
    }

    await this.repositorio.atualizar(id, dados);
  }
}
