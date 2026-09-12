import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../../../lancamentos-contabeis/aplicacao/portas/lancamentos-repositorio.port';
import { CONTAS_RECEBER_REPOSITORIO, ContasReceberRepositorioPort } from '../portas/contas-receber-repositorio.port';

@Injectable()
export class EstornarRecebimentoUseCase {
  constructor(
    @Inject(CONTAS_RECEBER_REPOSITORIO) private readonly repositorio: ContasReceberRepositorioPort,
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly lancamentos: LancamentosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(recebimentoId: string, empresaId: string, motivo: string, usuarioId: string): Promise<void> {
    const recebimento = await this.repositorio.obterRecebimento(recebimentoId);
    if (!recebimento || recebimento.empresaId !== empresaId) {
      throw new NotFoundException('Recebimento não encontrado');
    }
    if (recebimento.estornado) {
      throw new BadRequestException('Recebimento já foi estornado anteriormente');
    }

    await this.lancamentos.estornar(recebimento.lancamentoId, motivo, usuarioId);
    await this.repositorio.marcarRecebimentoEstornado(recebimentoId);

    await this.auditoria.registrar({
      usuarioId,
      empresaId,
      acao: 'ESTORNAR_RECEBIMENTO_CONTA_RECEBER',
      recurso: `recebimentos_contas_receber:${recebimentoId}`,
      dadosAntigos: { valorRecebido: recebimento.valorRecebido },
      dadosNovos: { motivo },
    });
  }
}
