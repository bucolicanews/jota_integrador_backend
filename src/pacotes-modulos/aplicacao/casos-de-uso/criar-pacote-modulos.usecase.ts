import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { modulosValidos } from '../../dominio/pacote-modulos';
import { DadosPacoteModulos, PACOTES_MODULOS_REPOSITORIO, PacoteModulos, PacotesModulosRepositorioPort } from '../portas/pacotes-modulos-repositorio.port';

@Injectable()
export class CriarPacoteModulosUseCase {
  constructor(@Inject(PACOTES_MODULOS_REPOSITORIO) private readonly repositorio: PacotesModulosRepositorioPort) {}

  async executar(dados: DadosPacoteModulos): Promise<PacoteModulos> {
    if (!modulosValidos(dados.modulos)) {
      throw new BadRequestException('Pacote precisa de ao menos 1 módulo válido');
    }
    return this.repositorio.criar(dados);
  }
}
