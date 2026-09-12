import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENTOS_SOCIETARIOS_REPOSITORIO, DocumentosSocietariosRepositorioPort, DocumentoSocietarioGerado, FiltroDocumentosSocietarios } from '../portas/documentos-societarios-repositorio.port';

@Injectable()
export class ListarDocumentosSocietariosUseCase {
  constructor(@Inject(DOCUMENTOS_SOCIETARIOS_REPOSITORIO) private readonly repositorio: DocumentosSocietariosRepositorioPort) {}

  async executar(empresaId: string, filtro?: FiltroDocumentosSocietarios): Promise<DocumentoSocietarioGerado[]> {
    return this.repositorio.listarDocumentosPorEmpresa(empresaId, filtro);
  }
}
