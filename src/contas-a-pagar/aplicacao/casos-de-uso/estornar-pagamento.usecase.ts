import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../../../lancamentos-contabeis/aplicacao/portas/lancamentos-repositorio.port';
import { CONTAS_PAGAR_REPOSITORIO, ContasPagarRepositorioPort } from '../portas/contas-pagar-repositorio.port';

/**
 * Cria o lançamento inverso (via `estornar_lancamento_contabil`, já existe) e marca o
 * pagamento como estornado -- nunca deleta e recria, ao contrário do
 * `EditarParcelaPagaDialog` do jotaCaixa, que apagava lançamentos direto pra "ajustar"
 * um recebimento já pago (achado real na mineração desta fase).
 */
@Injectable()
export class EstornarPagamentoUseCase {
  constructor(
    @Inject(CONTAS_PAGAR_REPOSITORIO) private readonly repositorio: ContasPagarRepositorioPort,
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly lancamentos: LancamentosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(pagamentoId: string, empresaId: string, motivo: string, usuarioId: string): Promise<void> {
    const pagamento = await this.repositorio.obterPagamento(pagamentoId);
    if (!pagamento || pagamento.empresaId !== empresaId) {
      throw new NotFoundException('Pagamento não encontrado');
    }
    if (pagamento.estornado) {
      throw new BadRequestException('Pagamento já foi estornado anteriormente');
    }

    await this.lancamentos.estornar(pagamento.lancamentoId, motivo, usuarioId);
    await this.repositorio.marcarPagamentoEstornado(pagamentoId);

    await this.auditoria.registrar({
      usuarioId,
      empresaId,
      acao: 'ESTORNAR_PAGAMENTO_CONTA_PAGAR',
      recurso: `pagamentos_contas_pagar:${pagamentoId}`,
      dadosAntigos: { valorPago: pagamento.valorPago },
      dadosNovos: { motivo },
    });
  }
}
