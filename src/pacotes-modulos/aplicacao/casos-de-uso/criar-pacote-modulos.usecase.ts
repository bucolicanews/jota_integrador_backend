import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { modulosValidos, validarPrecoGratuito } from '../../dominio/pacote-modulos';
import { DadosPacoteModulos, PACOTES_MODULOS_REPOSITORIO, PacoteModulos, PacotesModulosRepositorioPort } from '../portas/pacotes-modulos-repositorio.port';

@Injectable()
export class CriarPacoteModulosUseCase {
  constructor(@Inject(PACOTES_MODULOS_REPOSITORIO) private readonly repositorio: PacotesModulosRepositorioPort) {}

  async executar(dados: DadosPacoteModulos): Promise<PacoteModulos> {
    if (!modulosValidos(dados.modulos)) {
      throw new BadRequestException('Pacote precisa de ao menos 1 módulo válido');
    }
    try {
      validarPrecoGratuito(dados.preco, dados.gratuito);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }
    return this.repositorio.criar(dados);
  }
}
