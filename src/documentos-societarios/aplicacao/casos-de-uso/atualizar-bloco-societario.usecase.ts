import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DadosBlocoSocietario, DOCUMENTOS_SOCIETARIOS_REPOSITORIO, DocumentosSocietariosRepositorioPort } from '../portas/documentos-societarios-repositorio.port';

@Injectable()
export class AtualizarBlocoSocietarioUseCase {
  constructor(@Inject(DOCUMENTOS_SOCIETARIOS_REPOSITORIO) private readonly repositorio: DocumentosSocietariosRepositorioPort) {}

  async executar(id: string, empresaId: string, dados: Partial<DadosBlocoSocietario>): Promise<void> {
    const bloco = await this.repositorio.obterBlocoPorId(id);
    if (!bloco || bloco.empresaId !== empresaId) {
      throw new NotFoundException('Bloco societário não encontrado');
    }
    await this.repositorio.atualizarBloco(id, dados);
  }
}
