import { Inject, Injectable, Logger } from '@nestjs/common';
import { PagbankConfigService } from '../../../common/pagbank/pagbank-config.service';
import { CreditarCreditosUseCase } from '../../../creditos/aplicacao/casos-de-uso/creditar-creditos.usecase';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import {
  PACOTES_CREDITOS_AVULSOS_REPOSITORIO,
  PacotesCreditosAvulsosRepositorioPort,
} from '../portas/pacotes-creditos-avulsos-repositorio.port';
import {
  PAGAMENTOS_CREDITOS_AVULSOS_REPOSITORIO,
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
    @Inject(PACOTES_CREDITOS_AVULSOS_REPOSITORIO) private readonly pacotesRepositorio: PacotesCreditosAvulsosRepositorioPort,
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
    await this.creditarPacote(pagamento.empresaId, pagamento.pacoteId, pagamento.id);

    return { processado: true };
  }

  private async creditarPacote(empresaId: string, pacoteId: string, pagamentoId: string): Promise<void> {
    const pacote = await this.pacotesRepositorio.buscarPorId(pacoteId);
    if (!pacote) {
      this.logger.error(`Pagamento ${pagamentoId} referencia pacote ${pacoteId} que não existe mais.`);
      return;
    }
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      this.logger.error(`Pagamento ${pagamentoId} referencia empresa ${empresaId} que não existe mais.`);
      return;
    }

    // contadorId só pra manter a linhagem no ledger (de qual carteira é a empresa) --
    // NÃO representa split/comissão, o contador não recebe nada desta compra.
    await this.creditar.executar(
      empresa.contadorId,
      empresaId,
      pacote.quantidadeCreditos,
      `Compra de crédito avulso "${pacote.nome}" (pagamento PagBank ${pagamentoId})`,
      'COMPRA_AVULSA',
    );
  }
}
