import { Inject, Injectable } from '@nestjs/common';
import { BlocoSocietario, DadosBlocoSocietario, DOCUMENTOS_SOCIETARIOS_REPOSITORIO, DocumentosSocietariosRepositorioPort } from '../portas/documentos-societarios-repositorio.port';

@Injectable()
export class CriarBlocoSocietarioUseCase {
  constructor(@Inject(DOCUMENTOS_SOCIETARIOS_REPOSITORIO) private readonly repositorio: DocumentosSocietariosRepositorioPort) {}

  async executar(dados: DadosBlocoSocietario): Promise<BlocoSocietario> {
    return this.repositorio.criarBloco(dados);
  }
}
