import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { renderizarTags } from '../../../common/tags/renderizar-tags';
import { CLIENTES_REPOSITORIO, ClientesRepositorioPort } from '../../../clientes/aplicacao/portas/clientes-repositorio.port';
import { DOCUMENTOS_SOCIETARIOS_REPOSITORIO, DocumentosSocietariosRepositorioPort, DocumentoSocietarioGerado } from '../portas/documentos-societarios-repositorio.port';

export interface DadosCriarDocumentoSocietario {
  empresaId: string;
  modeloId: string;
  clienteId: string | null;
  titulo: string;
  valoresTags: Record<string, string>;
  dataRegistro: string | null;
  criadoPor: string;
}

/** Sem financeiro, sem assinatura pública -- diferente de contratos, aqui o conteúdo renderizado vira conteudo_principal_manual (cópia inicial livremente editável depois). */
@Injectable()
export class CriarDocumentoSocietarioUseCase {
  constructor(
    @Inject(DOCUMENTOS_SOCIETARIOS_REPOSITORIO) private readonly repositorio: DocumentosSocietariosRepositorioPort,
    @Inject(CLIENTES_REPOSITORIO) private readonly clientes: ClientesRepositorioPort,
  ) {}

  async executar(dados: DadosCriarDocumentoSocietario): Promise<DocumentoSocietarioGerado> {
    const modelo = await this.repositorio.obterModeloPorId(dados.modeloId);
    if (!modelo || modelo.empresaId !== dados.empresaId) {
      throw new NotFoundException('Modelo societário não encontrado');
    }

    if (dados.clienteId) {
      const cliente = await this.clientes.obterPorId(dados.clienteId);
      if (!cliente || cliente.empresaId !== dados.empresaId) {
        throw new NotFoundException('Cliente não encontrado');
      }
    }

    const conteudoRenderizado = renderizarTags(modelo.conteudoTemplate, dados.valoresTags);

    return this.repositorio.criarDocumento({
      empresaId: dados.empresaId,
      modeloId: dados.modeloId,
      clienteId: dados.clienteId,
      titulo: dados.titulo,
      valoresTags: dados.valoresTags,
      conteudoRenderizado,
      dataRegistro: dados.dataRegistro,
      criadoPor: dados.criadoPor,
    });
  }
}
