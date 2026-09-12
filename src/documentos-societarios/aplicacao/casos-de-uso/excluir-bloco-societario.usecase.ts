import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DOCUMENTOS_SOCIETARIOS_REPOSITORIO, DocumentosSocietariosRepositorioPort } from '../portas/documentos-societarios-repositorio.port';

@Injectable()
export class ExcluirBlocoSocietarioUseCase {
  constructor(@Inject(DOCUMENTOS_SOCIETARIOS_REPOSITORIO) private readonly repositorio: DocumentosSocietariosRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<void> {
    const bloco = await this.repositorio.obterBlocoPorId(id);
    if (!bloco || bloco.empresaId !== empresaId) {
      throw new NotFoundException('Bloco societário não encontrado');
    }
    await this.repositorio.excluirBloco(id);
  }
}
