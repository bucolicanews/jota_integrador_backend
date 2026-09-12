import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { podeExcluir } from '../../dominio/documento-societario';
import { DOCUMENTOS_SOCIETARIOS_REPOSITORIO, DocumentosSocietariosRepositorioPort } from '../portas/documentos-societarios-repositorio.port';

@Injectable()
export class ExcluirDocumentoSocietarioUseCase {
  constructor(@Inject(DOCUMENTOS_SOCIETARIOS_REPOSITORIO) private readonly repositorio: DocumentosSocietariosRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<void> {
    const documento = await this.repositorio.obterDocumentoPorId(id);
    if (!documento || documento.empresaId !== empresaId) {
      throw new NotFoundException('Documento societário não encontrado');
    }
    if (!podeExcluir(documento.status)) {
      throw new BadRequestException('Só é possível excluir um documento societário em rascunho -- arquive em vez de excluir');
    }
    await this.repositorio.excluirDocumento(id);
  }
}
