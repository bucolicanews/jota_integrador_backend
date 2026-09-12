import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { StatusProtocolo, transicaoSimplesValida } from '../../dominio/protocolo';
import { PROTOCOLOS_REPOSITORIO, ProtocolosRepositorioPort } from '../portas/protocolos-repositorio.port';

/** criado->impresso (grava data_impressao) ou impresso->transito -- as duas únicas transições sem efeito colateral de upload. transito->entregue é RegistrarEntregaProtocoloUseCase (exige foto). */
@Injectable()
export class AvancarStatusProtocoloUseCase {
  constructor(
    @Inject(PROTOCOLOS_REPOSITORIO) private readonly repositorio: ProtocolosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, novoStatus: StatusProtocolo, usuarioId: string): Promise<void> {
    const protocolo = await this.repositorio.obterPorId(id);
    if (!protocolo || protocolo.empresaId !== empresaId) {
      throw new NotFoundException('Protocolo não encontrado');
    }
    if (!transicaoSimplesValida(protocolo.status, novoStatus)) {
      throw new BadRequestException(`Não é possível ir de "${protocolo.status}" para "${novoStatus}" por esta rota`);
    }

    await this.repositorio.avancarStatus(id, novoStatus, {
      dataImpressao: novoStatus === 'impresso' ? new Date().toISOString() : undefined,
    });

    await this.auditoria.registrar({
      usuarioId,
      empresaId,
      acao: 'AVANCAR_STATUS_PROTOCOLO',
      recurso: `protocolos:${id}`,
      dadosAntigos: { status: protocolo.status },
      dadosNovos: { status: novoStatus },
    });
  }
}
