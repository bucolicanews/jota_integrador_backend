import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { podeFinalizar } from '../../dominio/documento-societario';
import { DOCUMENTOS_SOCIETARIOS_REPOSITORIO, DocumentosSocietariosRepositorioPort } from '../portas/documentos-societarios-repositorio.port';

@Injectable()
export class FinalizarDocumentoSocietarioUseCase {
  constructor(@Inject(DOCUMENTOS_SOCIETARIOS_REPOSITORIO) private readonly repositorio: DocumentosSocietariosRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<void> {
    const documento = await this.repositorio.obterDocumentoPorId(id);
    if (!documento || documento.empresaId !== empresaId) {
      throw new NotFoundException('Documento societário não encontrado');
    }
    if (!podeFinalizar(documento.status)) {
      throw new BadRequestException('Documento societário não está em rascunho');
    }
    await this.repositorio.marcarStatus(id, 'finalizado');
  }
}
