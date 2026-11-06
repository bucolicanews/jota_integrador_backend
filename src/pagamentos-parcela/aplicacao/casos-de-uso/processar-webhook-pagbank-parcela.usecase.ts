import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { PagbankConfigService } from '../../../common/pagbank/pagbank-config.service';
import { BANCOS_REPOSITORIO, BancosRepositorioPort } from '../../../bancos/aplicacao/portas/bancos-repositorio.port';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { RegistrarRecebimentoUseCase } from '../../../contas-a-receber/aplicacao/casos-de-uso/registrar-recebimento.usecase';
import { ContasReceberRepositorioPort, CONTAS_RECEBER_REPOSITORIO } from '../../../contas-a-receber/aplicacao/portas/contas-receber-repositorio.port';
import {
  LinkPagamentoParcela,
  LINKS_PAGAMENTO_PARCELA_REPOSITORIO,
  LinksPagamentoParcelaRepositorioPort,
} from '../portas/links-pagamento-parcela-repositorio.port';

const STATUS_PAGOS = ['PAID', 'COMPLETED', 'AVAILABLE'];

/**
 * PagBank NÃO assina notificações -- nunca confiar no status vindo no corpo do POST.
 * Reconsulta a ordem via API (autoritativa) antes de marcar paga. Idempotência pelo
 * status LOCAL (links_pagamento_parcela.status), mesmo desenho de
 * ProcessarWebhookPagbankHonorarioUseCase. Quando confirma, registra o recebimento real
 * na parcela (banco padrão da empresa) -- é isso que fecha o ciclo contábil, não só o
 * status do link.
 */
@Injectable()
export class ProcessarWebhookPagbankParcelaUseCase {
  private readonly logger = new Logger(ProcessarWebhookPagbankParcelaUseCase.name);

  constructor(
    @Inject(LINKS_PAGAMENTO_PARCELA_REPOSITORIO)
    private readonly linksRepositorio: LinksPagamentoParcelaRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(BANCOS_REPOSITORIO) private readonly bancosRepositorio: BancosRepositorioPort,
    @Inject(CONTAS_RECEBER_REPOSITORIO) private readonly contasReceberRepositorio: ContasReceberRepositorioPort,
    private readonly registrarRecebimento: RegistrarRecebimentoUseCase,
    private readonly pagbankConfig: PagbankConfigService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(corpo: any): Promise<{ processado: boolean; motivo?: string }> {
    const payload = corpo?.data ?? corpo;
    const pagbankOrderId: string | undefined = payload?.id ?? payload?.reference_id;
    if (!pagbankOrderId) return { processado: false, motivo: 'id da ordem ausente no corpo' };

    const link = await this.linksRepositorio.buscarPorPagbankOrderId(pagbankOrderId);
    if (!link) return { processado: false, motivo: 'link de pagamento não encontrado' };
    if (link.status === 'pago') return { processado: false, motivo: 'já processado' };

    const { client } = await this.pagbankConfig.obterConfiguracaoSplit();
    const ordemReal = await client.buscarOrdem(pagbankOrderId);
    const detalhe = ordemReal?.charges?.[0];
    if (!detalhe) return { processado: false, motivo: 'ordem sem detalhe de cobrança' };

    const statusPagbank: string = detalhe?.status ?? '';
    const pago = STATUS_PAGOS.includes(statusPagbank);

    if (!pago) {
      if (statusPagbank === 'DECLINED') {
        await this.linksRepositorio.marcarFalhou(link.id);
      }
      return { processado: true };
    }

    const recebimentoId = await this.registrarRecebimentoAutomatico(link);

    await this.linksRepositorio.confirmarPagamento(link.id, {
      status: 'pago',
      pagbankChargeId: detalhe?.id ?? null,
      recebimentoId,
      pagoEm: new Date().toISOString(),
    });

    await this.registrarAuditoria(link, recebimentoId);

    return { processado: true };
  }

  /**
   * Fecha o ciclo contábil de verdade -- sem isso a parcela ficaria "paga" só no
   * PagBank, nunca refletindo no Plano de Contas (decisão confirmada com o usuário:
   * empresa cadastra um banco PADRÃO pra isso, `empresas.banco_pagbank_id`).
   */
  private async registrarRecebimentoAutomatico(link: LinkPagamentoParcela): Promise<string | null> {
    const empresa = await this.empresasRepositorio.buscarPorId(link.empresaId);
    const contaBancariaId = await this.resolverContaBancariaDestino(link, empresa);
    if (!contaBancariaId) return null;

    const parcela = await this.contasReceberRepositorio.obterParcela(link.parcelaId);
    if (!parcela || parcela.status === 'recebida' || parcela.status === 'cancelada') {
      // Parcela já foi liquidada por outro caminho (ex: recebimento manual registrado
      // entre a criação do link e a confirmação do webhook) -- não duplica o lançamento.
      return null;
    }

    const recebimento = await this.registrarRecebimento.executar({
      parcelaId: link.parcelaId,
      empresaId: link.empresaId,
      contaBancariaId,
      valorRecebido: link.valor,
      dataRecebimento: new Date().toISOString().slice(0, 10),
      usuarioId: link.criadoPor,
    });
    return recebimento.id;
  }

  /**
   * bancoPagbankId (empresa com módulo "bancos") tem prioridade; contaContabilPagbankId é
   * a alternativa pra empresa sem o módulo -- aponta direto pra uma conta do Plano de
   * Contas, sem precisar de um registro formal em `bancos`. Mutuamente exclusivos (ver
   * AtualizarPagbankContaEmpresaUseCase).
   */
  private async resolverContaBancariaDestino(link: LinkPagamentoParcela, empresa: Empresa | null): Promise<string | null> {
    if (empresa?.bancoPagbankId) {
      const banco = await this.bancosRepositorio.obterPorId(empresa.bancoPagbankId);
      if (!banco) {
        this.logger.error(`Link ${link.id} pago mas banco_pagbank_id da empresa ${link.empresaId} não existe mais -- recebimento NÃO registrado, requer conciliação manual`);
        return null;
      }
      return banco.contaContabilId;
    }
    if (empresa?.contaContabilPagbankId) {
      return empresa.contaContabilPagbankId;
    }
    this.logger.error(`Link ${link.id} pago mas empresa ${link.empresaId} sem destino de recebimento configurado -- recebimento NÃO registrado, requer conciliação manual`);
    return null;
  }

  private async registrarAuditoria(link: LinkPagamentoParcela, recebimentoId: string | null): Promise<void> {
    await this.auditoria.registrar({
      usuarioId: null,
      empresaId: link.empresaId,
      acao: 'link_pagamento_parcela.pago',
      recurso: 'links_pagamento_parcela',
      dadosNovos: { linkId: link.id, valor: link.valor, comissaoValor: link.comissaoValor, recebimentoId },
    });
  }
}
