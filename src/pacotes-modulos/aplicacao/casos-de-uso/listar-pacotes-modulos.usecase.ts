import { Inject, Injectable } from '@nestjs/common';
import { PACOTES_MODULOS_REPOSITORIO, PacoteModulos, PacotesModulosRepositorioPort } from '../portas/pacotes-modulos-repositorio.port';

@Injectable()
export class ListarPacotesModulosUseCase {
  constructor(@Inject(PACOTES_MODULOS_REPOSITORIO) private readonly repositorio: PacotesModulosRepositorioPort) {}

  async executar(apenasAtivos?: boolean): Promise<PacoteModulos[]> {
    return this.repositorio.listar(apenasAtivos);
  }
}
