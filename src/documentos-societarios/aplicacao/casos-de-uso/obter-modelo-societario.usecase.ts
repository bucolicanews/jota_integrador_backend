import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DOCUMENTOS_SOCIETARIOS_REPOSITORIO, DocumentosSocietariosRepositorioPort, ModeloSocietario } from '../portas/documentos-societarios-repositorio.port';

@Injectable()
export class ObterModeloSocietarioUseCase {
  constructor(@Inject(DOCUMENTOS_SOCIETARIOS_REPOSITORIO) private readonly repositorio: DocumentosSocietariosRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<ModeloSocietario> {
    const modelo = await this.repositorio.obterModeloPorId(id);
    if (!modelo || modelo.empresaId !== empresaId) {
      throw new NotFoundException('Modelo societário não encontrado');
    }
    return modelo;
  }
}
