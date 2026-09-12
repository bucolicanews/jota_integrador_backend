import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DOCUMENTOS_SOCIETARIOS_REPOSITORIO, DocumentosSocietariosRepositorioPort, DocumentoSocietarioGerado } from '../portas/documentos-societarios-repositorio.port';

@Injectable()
export class ObterDocumentoSocietarioUseCase {
  constructor(@Inject(DOCUMENTOS_SOCIETARIOS_REPOSITORIO) private readonly repositorio: DocumentosSocietariosRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<DocumentoSocietarioGerado> {
    const documento = await this.repositorio.obterDocumentoPorId(id);
    if (!documento || documento.empresaId !== empresaId) {
      throw new NotFoundException('Documento societário não encontrado');
    }
    return documento;
  }
}
