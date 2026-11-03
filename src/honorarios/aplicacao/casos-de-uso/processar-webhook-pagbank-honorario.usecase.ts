import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { PagbankConfigService } from '../../../common/pagbank/pagbank-config.service';
import {
  CobrancaHonorario,
  COBRANCAS_HONORARIOS_REPOSITORIO,
  CobrancasHonorariosRepositorioPort,
} from '../portas/cobrancas-honorarios-repositorio.port';

const STATUS_PAGOS = ['PAID', 'COMPLETED', 'AVAILABLE'];

/**
 * PagBank NÃO assina notificações -- nunca confiar no status vindo no corpo do POST.
 * Reconsulta a ordem via API (autoritativa) antes de marcar paga. Idempotência pelo
 * status LOCAL (cobrancas_honorarios.status), mesmo desenho de
 * ProcessarWebhookPagbankCreditosUseCase/ProcessarWebhookPagbankLicencaUseCase.
 */
@Injectable()
export class ProcessarWebhookPagbankHonorarioUseCase {
  private readonly logger = new Logger(ProcessarWebhookPagbankHonorarioUseCase.name);

  constructor(
    @Inject(COBRANCAS_HONORARIOS_REPOSITORIO)
    private readonly cobrancasRepositorio: CobrancasHonorariosRepositorioPort,
    private readonly pagbankConfig: PagbankConfigService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(corpo: any): Promise<{ processado: boolean; motivo?: string }> {
    const payload = corpo?.data ?? corpo;
    const pagbankOrderId: string | undefined = payload?.id ?? payload?.reference_id;
    if (!pagbankOrderId) return { processado: false, motivo: 'id da ordem ausente no corpo' };

    const cobranca = await this.cobrancasRepositorio.buscarPorPagbankOrderId(pagbankOrderId);
    if (!cobranca) return { processado: false, motivo: 'cobrança não encontrada' };
    if (cobranca.status === 'pago') return { processado: false, motivo: 'já processado' };

    const { client } = await this.pagbankConfig.obterConfiguracaoSplit();
    const ordemReal = await client.buscarOrdem(pagbankOrderId);
    const detalhe = ordemReal?.charges?.[0];
    if (!detalhe) return { processado: false, motivo: 'ordem sem detalhe de cobrança' };

    const statusPagbank: string = detalhe?.status ?? '';
    const pago = STATUS_PAGOS.includes(statusPagbank);

    if (!pago) {
      if (statusPagbank === 'DECLINED') {
        await this.cobrancasRepositorio.marcarFalhou(cobranca.id);
      }
      return { processado: true };
    }

    await this.cobrancasRepositorio.atualizarPagamento(cobranca.id, {
      status: 'pago',
      pagbankChargeId: detalhe?.id ?? null,
      pagoEm: new Date().toISOString(),
    });

    await this.registrarAuditoria(cobranca);

    return { processado: true };
  }

  private async registrarAuditoria(cobranca: CobrancaHonorario): Promise<void> {
    await this.auditoria.registrar({
      usuarioId: null,
      contadorId: cobranca.contadorId,
      empresaId: cobranca.empresaId,
      acao: 'honorario.pago',
      recurso: 'cobrancas_honorarios',
      dadosNovos: { cobrancaId: cobranca.id, valor: cobranca.valor, comissaoValor: cobranca.comissaoValor },
    });
  }
}
