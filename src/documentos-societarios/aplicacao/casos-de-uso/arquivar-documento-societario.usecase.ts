import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { podeArquivar } from '../../dominio/documento-societario';
import { DOCUMENTOS_SOCIETARIOS_REPOSITORIO, DocumentosSocietariosRepositorioPort } from '../portas/documentos-societarios-repositorio.port';

@Injectable()
export class ArquivarDocumentoSocietarioUseCase {
  constructor(@Inject(DOCUMENTOS_SOCIETARIOS_REPOSITORIO) private readonly repositorio: DocumentosSocietariosRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<void> {
    const documento = await this.repositorio.obterDocumentoPorId(id);
    if (!documento || documento.empresaId !== empresaId) {
      throw new NotFoundException('Documento societário não encontrado');
    }
    if (!podeArquivar(documento.status)) {
      throw new BadRequestException('Só um documento societário finalizado pode ser arquivado');
    }
    await this.repositorio.marcarStatus(id, 'arquivado');
  }
}
