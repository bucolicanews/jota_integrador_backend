import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { CLIENTES_REPOSITORIO, ClientesRepositorioPort } from '../../../clientes/aplicacao/portas/clientes-repositorio.port';
import { StorageProtocolosService } from '../../infraestrutura/storage-protocolos.service';
import { gerarNumeroProtocolo } from '../../dominio/protocolo';
import { AnexoProtocolo, PROTOCOLOS_REPOSITORIO, Protocolo, ProtocolosRepositorioPort } from '../portas/protocolos-repositorio.port';

export interface ArquivoAnexo {
  nomeOriginal: string;
  buffer: Buffer;
  contentType: string;
}

export interface DadosCriarProtocolo {
  empresaId: string;
  clienteId: string;
  titulo: string;
  descricao: string | null;
  linkTarefa: string | null;
  criadoPor: string;
  usuarioCriadorNome: string | null;
  anexos: ArquivoAnexo[];
}

export interface ResultadoCriarProtocolo {
  protocolo: Protocolo;
  anexos: AnexoProtocolo[];
}

/** numero_protocolo gerado aqui (não no banco) -- mesmo critério de sempre resolver no servidor, nunca aceitar do cliente. */
@Injectable()
export class CriarProtocoloUseCase {
  constructor(
    @Inject(PROTOCOLOS_REPOSITORIO) private readonly repositorio: ProtocolosRepositorioPort,
    @Inject(CLIENTES_REPOSITORIO) private readonly clientes: ClientesRepositorioPort,
    private readonly storage: StorageProtocolosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosCriarProtocolo): Promise<ResultadoCriarProtocolo> {
    const cliente = await this.clientes.obterPorId(dados.clienteId);
    if (!cliente || cliente.empresaId !== dados.empresaId) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const protocolo = await this.repositorio.criar({
      empresaId: dados.empresaId,
      clienteId: dados.clienteId,
      numeroProtocolo: gerarNumeroProtocolo(),
      titulo: dados.titulo,
      descricao: dados.descricao,
      linkTarefa: dados.linkTarefa,
      criadoPor: dados.criadoPor,
      usuarioCriadorNome: dados.usuarioCriadorNome,
    });

    const anexos: AnexoProtocolo[] = [];
    for (const arquivo of dados.anexos) {
      const ref = await this.storage.armazenar(dados.empresaId, protocolo.id, arquivo.nomeOriginal, arquivo.buffer, arquivo.contentType);
      anexos.push(await this.repositorio.adicionarAnexo(protocolo.id, arquivo.nomeOriginal, ref));
    }

    await this.auditoria.registrar({
      usuarioId: dados.criadoPor,
      empresaId: dados.empresaId,
      acao: 'CRIAR_PROTOCOLO',
      recurso: `protocolos:${protocolo.id}`,
      dadosNovos: { clienteId: dados.clienteId, titulo: dados.titulo, numeroProtocolo: protocolo.numeroProtocolo, quantidadeAnexos: anexos.length },
    });

    return { protocolo, anexos };
  }
}
