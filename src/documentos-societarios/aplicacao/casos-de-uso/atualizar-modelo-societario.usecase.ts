import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DadosModeloSocietario, DOCUMENTOS_SOCIETARIOS_REPOSITORIO, DocumentosSocietariosRepositorioPort } from '../portas/documentos-societarios-repositorio.port';

@Injectable()
export class AtualizarModeloSocietarioUseCase {
  constructor(@Inject(DOCUMENTOS_SOCIETARIOS_REPOSITORIO) private readonly repositorio: DocumentosSocietariosRepositorioPort) {}

  async executar(id: string, empresaId: string, dados: Partial<DadosModeloSocietario>): Promise<void> {
    const modelo = await this.repositorio.obterModeloPorId(id);
    if (!modelo || modelo.empresaId !== empresaId) {
      throw new NotFoundException('Modelo societário não encontrado');
    }
    await this.repositorio.atualizarModelo(id, dados);
  }
}
