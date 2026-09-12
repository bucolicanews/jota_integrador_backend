import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENTOS_SOCIETARIOS_REPOSITORIO, DocumentosSocietariosRepositorioPort, ModeloSocietario } from '../portas/documentos-societarios-repositorio.port';

@Injectable()
export class ListarModelosSocietariosUseCase {
  constructor(@Inject(DOCUMENTOS_SOCIETARIOS_REPOSITORIO) private readonly repositorio: DocumentosSocietariosRepositorioPort) {}

  async executar(empresaId: string): Promise<ModeloSocietario[]> {
    return this.repositorio.listarModelosPorEmpresa(empresaId);
  }
}
