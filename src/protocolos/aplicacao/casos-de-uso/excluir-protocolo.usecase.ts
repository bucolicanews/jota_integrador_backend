import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { podeEditarOuExcluir } from '../../dominio/protocolo';
import { PROTOCOLOS_REPOSITORIO, ProtocolosRepositorioPort } from '../portas/protocolos-repositorio.port';

/** RLS (protocolos_delete) já bloqueia fora de criado/impresso -- checagem aqui é a mesma regra em profundidade, com mensagem clara em vez de erro genérico de RLS. */
@Injectable()
export class ExcluirProtocoloUseCase {
  constructor(
    @Inject(PROTOCOLOS_REPOSITORIO) private readonly repositorio: ProtocolosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, usuarioId: string): Promise<void> {
    const protocolo = await this.repositorio.obterPorId(id);
    if (!protocolo || protocolo.empresaId !== empresaId) {
      throw new NotFoundException('Protocolo não encontrado');
    }
    if (!podeEditarOuExcluir(protocolo.status)) {
      throw new BadRequestException(`Protocolo com status "${protocolo.status}" não pode mais ser excluído`);
    }
    await this.repositorio.excluir(id);

    await this.auditoria.registrar({
      usuarioId,
      empresaId,
      acao: 'EXCLUIR_PROTOCOLO',
      recurso: `protocolos:${id}`,
      dadosAntigos: { titulo: protocolo.titulo, numeroProtocolo: protocolo.numeroProtocolo },
    });
  }
}
