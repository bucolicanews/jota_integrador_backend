import { Inject, Injectable, Logger } from '@nestjs/common';
import { PagbankConfigService } from '../../../common/pagbank/pagbank-config.service';
import { CreditarCreditosUseCase } from '../../../creditos/aplicacao/casos-de-uso/creditar-creditos.usecase';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import {
  PAGAMENTOS_CREDITOS_AVULSOS_REPOSITORIO,
  PagamentoCreditoAvulso,
  PagamentosCreditosAvulsosRepositorioPort,
} from '../portas/pagamentos-creditos-avulsos-repositorio.port';

const STATUS_PAGOS = ['PAID', 'COMPLETED', 'AVAILABLE'];

/**
 * PagBank NÃO assina notificações -- nunca confiar no status vindo no corpo do POST.
 * Reconsulta a ordem via API (autoritativa) antes de creditar. Idempotência pelo status
 * LOCAL (pagamentos_creditos_avulsos.status), mesmo desenho de
 * ProcessarWebhookPagbankCreditosUseCase (assinaturas/) -- só que aqui não existe
 * contrato/registro contábil pro contador, porque ele não participa desta transação.
 */
@Injectable()
export class ProcessarWebhookCreditoAvulsoUseCase {
  private readonly logger = new Logger(ProcessarWebhookCreditoAvulsoUseCase.name);

  constructor(
    @Inject(PAGAMENTOS_CREDITOS_AVULSOS_REPOSITORIO) private readonly pagamentosRepositorio: PagamentosCreditosAvulsosRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly pagbankConfig: PagbankConfigService,
    private readonly creditar: CreditarCreditosUseCase,
  ) {}

  async executar(corpo: any): Promise<{ processado: boolean; motivo?: string }> {
    const payload = corpo?.data ?? corpo;
    const pagbankOrderId: string | undefined = payload?.id ?? payload?.reference_id;
    if (!pagbankOrderId) return { processado: false, motivo: 'id da ordem ausente no corpo' };

    const pagamento = await this.pagamentosRepositorio.obterPorPagbankOrderId(pagbankOrderId);
    if (!pagamento) return { processado: false, motivo: 'pagamento não encontrado' };
    if (pagamento.status === 'pago') return { processado: false, motivo: 'já processado' };

    const { client } = await this.pagbankConfig.obterConfiguracaoSplit();
    const ordemReal = await client.buscarOrdem(pagbankOrderId);
    const detalhe = ordemReal?.charges?.[0];
    if (!detalhe) return { processado: false, motivo: 'ordem sem detalhe de cobrança' };

    const statusPagbank: string = detalhe?.status ?? '';
    const pago = STATUS_PAGOS.includes(statusPagbank);

    if (!pago) {
      if (statusPagbank === 'DECLINED') {
        await this.pagamentosRepositorio.marcarFalhou(pagamento.id);
      }
      return { processado: true };
    }

    await this.pagamentosRepositorio.marcarPago(pagamento.id, detalhe?.id ?? null);
    await this.creditarQuantidade(pagamento);

    return { processado: true };
  }

  /** `quantidadeCreditos` já vem congelado no pagamento desde a criação da ordem -- nunca reconsulta pacote (resiliente a pacote desativado/apagado entre compra e confirmação, e já cobre o caminho de quantidade livre, que nem tem pacote). */
  private async creditarQuantidade(pagamento: PagamentoCreditoAvulso): Promise<void> {
    const empresa = await this.empresasRepositorio.buscarPorId(pagamento.empresaId);
    if (!empresa) {
      this.logger.error(`Pagamento ${pagamento.id} referencia empresa ${pagamento.empresaId} que não existe mais.`);
      return;
    }

    // contadorId só pra manter a linhagem no ledger (de qual carteira é a empresa) --
    // NÃO representa split/comissão, o contador não recebe nada desta compra (exceto no
    // caminho de revenda, já refletido no valor pago, não na quantidade creditada aqui).
    await this.creditar.executar(
      empresa.contadorId,
      pagamento.empresaId,
      pagamento.quantidadeCreditos,
      `Compra de crédito avulso (pagamento PagBank ${pagamento.id})`,
      'COMPRA_AVULSA',
    );
  }
}
