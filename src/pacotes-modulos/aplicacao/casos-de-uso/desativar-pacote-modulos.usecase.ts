import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PACOTES_MODULOS_REPOSITORIO, PacotesModulosRepositorioPort } from '../portas/pacotes-modulos-repositorio.port';

/** Desativar (nunca excluir) -- pacotes já vendidos (licencas_modulo.pacote_id) não podem virar referência quebrada. Só impede novas vendas. */
@Injectable()
export class DesativarPacoteModulosUseCase {
  constructor(@Inject(PACOTES_MODULOS_REPOSITORIO) private readonly repositorio: PacotesModulosRepositorioPort) {}

  async executar(id: string, ativo: boolean): Promise<void> {
    const pacote = await this.repositorio.obterPorId(id);
    if (!pacote) throw new NotFoundException('Pacote não encontrado');
    await this.repositorio.marcarAtivo(id, ativo);
  }
}
