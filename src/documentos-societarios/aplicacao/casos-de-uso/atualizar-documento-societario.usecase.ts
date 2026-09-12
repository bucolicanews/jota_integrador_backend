import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { podeEditar } from '../../dominio/documento-societario';
import { DadosAtualizarDocumentoSocietario, DOCUMENTOS_SOCIETARIOS_REPOSITORIO, DocumentosSocietariosRepositorioPort } from '../portas/documentos-societarios-repositorio.port';

@Injectable()
export class AtualizarDocumentoSocietarioUseCase {
  constructor(@Inject(DOCUMENTOS_SOCIETARIOS_REPOSITORIO) private readonly repositorio: DocumentosSocietariosRepositorioPort) {}

  async executar(id: string, empresaId: string, dados: DadosAtualizarDocumentoSocietario): Promise<void> {
    const documento = await this.repositorio.obterDocumentoPorId(id);
    if (!documento || documento.empresaId !== empresaId) {
      throw new NotFoundException('Documento societário não encontrado');
    }
    if (!podeEditar(documento.status)) {
      throw new BadRequestException('Só é possível editar um documento societário em rascunho');
    }
    await this.repositorio.atualizarDocumento(id, dados);
  }
}
