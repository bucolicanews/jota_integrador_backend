import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { transicaoCancelamentoValida } from '../../dominio/protocolo';
import { PROTOCOLOS_REPOSITORIO, ProtocolosRepositorioPort } from '../portas/protocolos-repositorio.port';

/** Diferente do jotaCaixa (só muda o status, sem motivo nenhum) -- aqui `observacao` é obrigatória, validada já no DTO (MinLength), pra sempre ficar rastreável por que um protocolo foi cancelado ou teve problema. */
@Injectable()
export class CancelarOuMarcarProblemaProtocoloUseCase {
  constructor(
    @Inject(PROTOCOLOS_REPOSITORIO) private readonly repositorio: ProtocolosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, status: 'cancelado' | 'problema', observacao: string, usuarioId: string): Promise<void> {
    const protocolo = await this.repositorio.obterPorId(id);
    if (!protocolo || protocolo.empresaId !== empresaId) {
      throw new NotFoundException('Protocolo não encontrado');
    }
    if (!transicaoCancelamentoValida(protocolo.status)) {
      throw new BadRequestException(`Protocolo com status "${protocolo.status}" não pode ser cancelado/marcado com problema`);
    }
    await this.repositorio.cancelarOuMarcarProblema(id, status, observacao);

    await this.auditoria.registrar({
      usuarioId,
      empresaId,
      acao: 'CANCELAR_OU_PROBLEMA_PROTOCOLO',
      recurso: `protocolos:${id}`,
      dadosAntigos: { status: protocolo.status },
      dadosNovos: { status, observacao },
    });
  }
}
