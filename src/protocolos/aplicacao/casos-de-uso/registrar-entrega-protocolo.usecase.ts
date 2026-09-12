import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { StorageProtocolosService } from '../../infraestrutura/storage-protocolos.service';
import { PROTOCOLOS_REPOSITORIO, ProtocolosRepositorioPort } from '../portas/protocolos-repositorio.port';

export interface DadosRegistrarEntrega {
  protocoloId: string;
  empresaId: string;
  usuarioId: string;
  nomeRespRecebimento: string;
  dataRecebimento: string;
  foto: { nomeOriginal: string; buffer: Buffer; contentType: string };
}

/** transito->entregue -- única transição com prova de entrega obrigatória (nome + data + foto do protocolo assinado). */
@Injectable()
export class RegistrarEntregaProtocoloUseCase {
  constructor(
    @Inject(PROTOCOLOS_REPOSITORIO) private readonly repositorio: ProtocolosRepositorioPort,
    private readonly storage: StorageProtocolosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosRegistrarEntrega): Promise<void> {
    const protocolo = await this.repositorio.obterPorId(dados.protocoloId);
    if (!protocolo || protocolo.empresaId !== dados.empresaId) {
      throw new NotFoundException('Protocolo não encontrado');
    }
    if (protocolo.status !== 'transito') {
      throw new BadRequestException(`Só é possível registrar entrega de um protocolo em trânsito (status atual: "${protocolo.status}")`);
    }

    const ref = await this.storage.armazenar(
      dados.empresaId,
      protocolo.id,
      dados.foto.nomeOriginal,
      dados.foto.buffer,
      dados.foto.contentType,
    );

    await this.repositorio.registrarEntrega(protocolo.id, {
      nomeRespRecebimento: dados.nomeRespRecebimento,
      dataRecebimento: dados.dataRecebimento,
      imgProtocoloRef: ref,
    });

    await this.auditoria.registrar({
      usuarioId: dados.usuarioId,
      empresaId: dados.empresaId,
      acao: 'REGISTRAR_ENTREGA_PROTOCOLO',
      recurso: `protocolos:${protocolo.id}`,
      dadosNovos: { nomeRespRecebimento: dados.nomeRespRecebimento, dataRecebimento: dados.dataRecebimento },
    });
  }
}
