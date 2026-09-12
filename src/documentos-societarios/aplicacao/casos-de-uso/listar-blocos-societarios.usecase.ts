import { Inject, Injectable } from '@nestjs/common';
import { BlocoSocietario, DOCUMENTOS_SOCIETARIOS_REPOSITORIO, DocumentosSocietariosRepositorioPort } from '../portas/documentos-societarios-repositorio.port';

@Injectable()
export class ListarBlocosSocietariosUseCase {
  constructor(@Inject(DOCUMENTOS_SOCIETARIOS_REPOSITORIO) private readonly repositorio: DocumentosSocietariosRepositorioPort) {}

  async executar(empresaId: string): Promise<BlocoSocietario[]> {
    return this.repositorio.listarBlocosPorEmpresa(empresaId);
  }
}
