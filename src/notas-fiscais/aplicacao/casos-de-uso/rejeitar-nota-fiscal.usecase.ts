import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { NOTAS_FISCAIS_REPOSITORIO, NotasFiscaisRepositorioPort } from '../portas/notas-fiscais-repositorio.port';

@Injectable()
export class RejeitarNotaFiscalUseCase {
  constructor(
    @Inject(NOTAS_FISCAIS_REPOSITORIO) private readonly repositorio: NotasFiscaisRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, motivoRejeicao: string, rejeitadoPor: string): Promise<void> {
    const nota = await this.repositorio.obterDetalhe(id, empresaId);
    if (!nota) throw new NotFoundException('Nota fiscal não encontrada');
    if (nota.status !== 'capturada') {
      throw new BadRequestException(`Nota já está "${nota.status}" -- só nota "capturada" pode ser rejeitada`);
    }

    await this.repositorio.marcarRejeitada(id, motivoRejeicao);

    await this.auditoria.registrar({
      usuarioId: rejeitadoPor,
      empresaId,
      acao: 'REJEITAR_NOTA_FISCAL',
      recurso: `notas_fiscais:${id}`,
      dadosNovos: { motivoRejeicao },
    });
  }
}
