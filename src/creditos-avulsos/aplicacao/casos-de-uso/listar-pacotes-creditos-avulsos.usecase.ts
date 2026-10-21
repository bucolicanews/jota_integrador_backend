import { Inject, Injectable } from '@nestjs/common';
import {
  PACOTES_CREDITOS_AVULSOS_REPOSITORIO,
  PacoteCreditoAvulso,
  PacotesCreditosAvulsosRepositorioPort,
} from '../portas/pacotes-creditos-avulsos-repositorio.port';

@Injectable()
export class ListarPacotesCreditosAvulsosUseCase {
  constructor(
    @Inject(PACOTES_CREDITOS_AVULSOS_REPOSITORIO) private readonly repositorio: PacotesCreditosAvulsosRepositorioPort,
  ) {}

  async executar(somenteAtivos: boolean): Promise<PacoteCreditoAvulso[]> {
    return this.repositorio.listar(somenteAtivos);
  }
}
