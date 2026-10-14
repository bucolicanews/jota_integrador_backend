import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PACOTES_MODULOS_REPOSITORIO, PacotesModulosRepositorioPort } from '../../../pacotes-modulos/aplicacao/portas/pacotes-modulos-repositorio.port';
import { validarMargem } from '../../dominio/plano-revenda-pacote';
import {
  DadosAtualizacaoPlanoRevenda,
  PLANOS_REVENDA_PACOTE_REPOSITORIO,
  PlanosRevendaPacoteRepositorioPort,
} from '../portas/planos-revenda-pacote-repositorio.port';

@Injectable()
export class AtualizarPlanoRevendaUseCase {
  constructor(
    @Inject(PLANOS_REVENDA_PACOTE_REPOSITORIO) private readonly repositorio: PlanosRevendaPacoteRepositorioPort,
    @Inject(PACOTES_MODULOS_REPOSITORIO) private readonly pacotesRepositorio: PacotesModulosRepositorioPort,
  ) {}

  async executar(id: string, dados: DadosAtualizacaoPlanoRevenda): Promise<void> {
    const plano = await this.repositorio.obterPorId(id);
    if (!plano) {
      throw new NotFoundException('Plano de revenda não encontrado');
    }

    if (dados.valorVenda !== undefined) {
      const pacote = await this.pacotesRepositorio.obterPorId(plano.pacoteId);
      if (!pacote) {
        throw new NotFoundException('Pacote não encontrado');
      }
      try {
        validarMargem(dados.valorVenda, pacote.preco);
      } catch (erro) {
        throw new BadRequestException((erro as Error).message);
      }
    }

    await this.repositorio.atualizar(id, dados);
  }
}
