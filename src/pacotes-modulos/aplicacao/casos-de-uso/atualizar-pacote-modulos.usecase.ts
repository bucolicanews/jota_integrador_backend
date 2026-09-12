import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { modulosValidos } from '../../dominio/pacote-modulos';
import { DadosPacoteModulos, PACOTES_MODULOS_REPOSITORIO, PacotesModulosRepositorioPort } from '../portas/pacotes-modulos-repositorio.port';

@Injectable()
export class AtualizarPacoteModulosUseCase {
  constructor(@Inject(PACOTES_MODULOS_REPOSITORIO) private readonly repositorio: PacotesModulosRepositorioPort) {}

  async executar(id: string, dados: Partial<DadosPacoteModulos>): Promise<void> {
    const pacote = await this.repositorio.obterPorId(id);
    if (!pacote) throw new NotFoundException('Pacote não encontrado');
    if (dados.modulos !== undefined && !modulosValidos(dados.modulos)) {
      throw new BadRequestException('Pacote precisa de ao menos 1 módulo válido');
    }
    await this.repositorio.atualizar(id, dados);
  }
}
