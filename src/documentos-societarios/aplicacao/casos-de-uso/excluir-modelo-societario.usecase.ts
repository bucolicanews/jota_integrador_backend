import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DOCUMENTOS_SOCIETARIOS_REPOSITORIO, DocumentosSocietariosRepositorioPort } from '../portas/documentos-societarios-repositorio.port';

@Injectable()
export class ExcluirModeloSocietarioUseCase {
  constructor(@Inject(DOCUMENTOS_SOCIETARIOS_REPOSITORIO) private readonly repositorio: DocumentosSocietariosRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<void> {
    const modelo = await this.repositorio.obterModeloPorId(id);
    if (!modelo || modelo.empresaId !== empresaId) {
      throw new NotFoundException('Modelo societário não encontrado');
    }
    // on delete set null em documentos_societarios_gerados.modelo_id -- documento já gerado
    // não trava a exclusão do modelo (diferente de modelos_contrato, ver comentário na migration).
    await this.repositorio.excluirModelo(id);
  }
}
