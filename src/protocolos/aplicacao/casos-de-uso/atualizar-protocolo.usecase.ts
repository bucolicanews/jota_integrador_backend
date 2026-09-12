import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { podeEditarOuExcluir } from '../../dominio/protocolo';
import { DadosAtualizarProtocolo, PROTOCOLOS_REPOSITORIO, ProtocolosRepositorioPort } from '../portas/protocolos-repositorio.port';

@Injectable()
export class AtualizarProtocoloUseCase {
  constructor(
    @Inject(PROTOCOLOS_REPOSITORIO) private readonly repositorio: ProtocolosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, dados: DadosAtualizarProtocolo, usuarioId: string): Promise<void> {
    const protocolo = await this.repositorio.obterPorId(id);
    if (!protocolo || protocolo.empresaId !== empresaId) {
      throw new NotFoundException('Protocolo não encontrado');
    }
    if (!podeEditarOuExcluir(protocolo.status)) {
      throw new BadRequestException(`Protocolo com status "${protocolo.status}" não pode mais ser editado`);
    }
    await this.repositorio.atualizar(id, dados);

    await this.auditoria.registrar({
      usuarioId,
      empresaId,
      acao: 'ATUALIZAR_PROTOCOLO',
      recurso: `protocolos:${id}`,
      dadosNovos: dados,
    });
  }
}
