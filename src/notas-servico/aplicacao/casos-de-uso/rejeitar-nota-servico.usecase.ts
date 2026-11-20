import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { NOTAS_SERVICO_REPOSITORIO, NotasServicoRepositorioPort } from '../portas/notas-servico-repositorio.port';

@Injectable()
export class RejeitarNotaServicoUseCase {
  constructor(
    @Inject(NOTAS_SERVICO_REPOSITORIO) private readonly notasServicoRepositorio: NotasServicoRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, motivoRejeicao: string, usuarioId: string): Promise<void> {
    const nota = await this.notasServicoRepositorio.obterDetalhe(id, empresaId);
    if (!nota) throw new NotFoundException('NFS-e não encontrada');
    if (nota.status !== 'capturada') throw new BadRequestException('Só é possível rejeitar NFS-e com status "capturada"');

    await this.notasServicoRepositorio.marcarRejeitada(id, motivoRejeicao);

    await this.auditoria.registrar({
      usuarioId,
      empresaId,
      acao: 'REJEITAR_NOTA_SERVICO',
      recurso: `notas_servico:${id}`,
      dadosNovos: { chaveAcesso: nota.chaveAcesso, motivoRejeicao },
    });
  }
}
