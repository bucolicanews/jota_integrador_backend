import { Inject, Injectable } from '@nestjs/common';
import { DadosModeloSocietario, DOCUMENTOS_SOCIETARIOS_REPOSITORIO, DocumentosSocietariosRepositorioPort, ModeloSocietario } from '../portas/documentos-societarios-repositorio.port';

@Injectable()
export class CriarModeloSocietarioUseCase {
  constructor(@Inject(DOCUMENTOS_SOCIETARIOS_REPOSITORIO) private readonly repositorio: DocumentosSocietariosRepositorioPort) {}

  async executar(dados: DadosModeloSocietario): Promise<ModeloSocietario> {
    return this.repositorio.criarModelo(dados);
  }
}
