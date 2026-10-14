import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PACOTES_MODULOS_REPOSITORIO, PacotesModulosRepositorioPort } from '../../../pacotes-modulos/aplicacao/portas/pacotes-modulos-repositorio.port';
import { validarMargem } from '../../dominio/plano-revenda-pacote';
import {
  DadosNovoPlanoRevenda,
  PLANOS_REVENDA_PACOTE_REPOSITORIO,
  PlanoRevendaPacote,
  PlanosRevendaPacoteRepositorioPort,
} from '../portas/planos-revenda-pacote-repositorio.port';

@Injectable()
export class CriarPlanoRevendaUseCase {
  constructor(
    @Inject(PLANOS_REVENDA_PACOTE_REPOSITORIO) private readonly repositorio: PlanosRevendaPacoteRepositorioPort,
    @Inject(PACOTES_MODULOS_REPOSITORIO) private readonly pacotesRepositorio: PacotesModulosRepositorioPort,
  ) {}

  async executar(dados: DadosNovoPlanoRevenda): Promise<PlanoRevendaPacote> {
    const pacote = await this.pacotesRepositorio.obterPorId(dados.pacoteId);
    if (!pacote) {
      throw new NotFoundException('Pacote não encontrado');
    }
    try {
      validarMargem(dados.valorVenda, pacote.preco);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }
    return this.repositorio.criar(dados);
  }
}
