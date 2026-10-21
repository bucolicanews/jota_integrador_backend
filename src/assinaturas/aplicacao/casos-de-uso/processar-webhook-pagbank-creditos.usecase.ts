import { Inject, Injectable, Logger } from '@nestjs/common';
import { PagbankConfigService } from '../../../common/pagbank/pagbank-config.service';
import { UsuarioSistemaService } from '../../../common/usuario-sistema/usuario-sistema.service';
import { CriarContratoUseCase } from '../../../contratos/aplicacao/casos-de-uso/criar-contrato.usecase';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../../../contratos/aplicacao/portas/contratos-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { PLANOS_REPOSITORIO, PlanosRepositorioPort } from '../../../planos/aplicacao/portas/planos-repositorio.port';
import {
  ASSINATURAS_REPOSITORIO,
  AssinaturasRepositorioPort,
} from '../portas/assinaturas-repositorio.port';
import {
  PAGAMENTOS_ASSINATURA_CREDITOS_REPOSITORIO,
  PagamentoAssinaturaCredito,
  PagamentosAssinaturaCreditosRepositorioPort,
} from '../portas/pagamentos-assinatura-creditos-repositorio.port';

const STATUS_PAGOS = ['PAID', 'COMPLETED', 'AVAILABLE'];
const TITULO_MODELO_ASSINATURA = 'Assinatura de Créditos SERPRO (padrão do sistema)';
const TEMPLATE_MODELO_ASSINATURA =
  'Assinatura de créditos SERPRO entre {{EMPRESA_RAZAO_SOCIAL}} e {{CLIENTE_NOME}}.\n\nPlano: conforme contratado.\nValor: {{VALOR_TOTAL}} em {{QUANTIDADE_PARCELAS}}x.\nData: {{DATA_HOJE}}.';

/**
 * PagBank NÃO assina notificações -- nunca confiar no status vindo no corpo do POST.
 * Reconsulta a ordem via API (autoritativa) antes de ativar qualquer coisa. Idempotência
 * pelo status LOCAL (pagamentos_assinatura_creditos.status), não pela tabela genérica
 * webhook_eventos_processados -- mesmo desenho de ProcessarWebhookPagbankLicencaUseCase.
 */
@Injectable()
export class ProcessarWebhookPagbankCreditosUseCase {
  private readonly logger = new Logger(ProcessarWebhookPagbankCreditosUseCase.name);

  constructor(
    @Inject(PAGAMENTOS_ASSINATURA_CREDITOS_REPOSITORIO) private readonly pagamentosRepositorio: PagamentosAssinaturaCreditosRepositorioPort,
    @Inject(ASSINATURAS_REPOSITORIO) private readonly assinaturasRepositorio: AssinaturasRepositorioPort,
    @Inject(PLANOS_REPOSITORIO) private readonly planosRepositorio: PlanosRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(CONTRATOS_REPOSITORIO) private readonly contratosRepositorio: ContratosRepositorioPort,
    private readonly pagbankConfig: PagbankConfigService,
    private readonly criarContrato: CriarContratoUseCase,
    private readonly usuarioSistema: UsuarioSistemaService,
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
    await this.ativarOuRenovarAssinatura(pagamento);
    await this.registrarContabilmente(pagamento);

    return { processado: true };
  }

  private async ativarOuRenovarAssinatura(pagamento: PagamentoAssinaturaCredito): Promise<void> {
    const plano = await this.planosRepositorio.buscarPorId(pagamento.planoId);
    if (!plano) {
      this.logger.error(`Pagamento ${pagamento.id} referencia plano ${pagamento.planoId} que não existe mais.`);
      return;
    }

    const atual = await this.assinaturasRepositorio.buscarPorEmpresa(pagamento.empresaId);
    if (atual) {
      await this.assinaturasRepositorio.atualizar(atual.id, { planoId: pagamento.planoId, planoRevendaId: pagamento.planoRevendaId });
      if (atual.status !== 'ativa') {
        await this.assinaturasRepositorio.atualizarStatus(atual.id, 'ativa');
      }
    } else {
      await this.assinaturasRepositorio.criar({
        contadorId: pagamento.contadorId,
        empresaId: pagamento.empresaId,
        planoId: pagamento.planoId,
        planoRevendaId: pagamento.planoRevendaId,
      });
    }
  }

  /** Dinheiro já se moveu via PagBank -- isto só espelha nos livros de cada lado (mesmo papel de registrarContabilmente no webhook de licença). */
  private async registrarContabilmente(pagamento: PagamentoAssinaturaCredito): Promise<void> {
    const empresaInterna = await this.empresasRepositorio.buscarEmpresaInternaDoContador(pagamento.contadorId);
    if (!empresaInterna) {
      this.logger.error(`Contador ${pagamento.contadorId} sem empresa interna -- não foi possível registrar o pagamento de assinatura nos livros.`);
      return;
    }

    const modelo = await this.obterOuCriarModeloAssinatura(empresaInterna.id);
    const executadoPor = await this.usuarioSistema.obterOuCriarId();

    await this.criarContrato.executar({
      empresaId: empresaInterna.id,
      modeloId: modelo.id,
      clienteId: null,
      empresaContraparteId: pagamento.empresaId,
      titulo: 'Assinatura de créditos SERPRO (paga via PagBank)',
      valoresTagsManuais: {},
      valorTotal: pagamento.valorTotal,
      parcelamento: { modo: 'unico', quantidadeParcelas: 1, primeiroVencimento: new Date().toISOString().slice(0, 10), intervaloDias: 30 },
      criadoPor: executadoPor,
    });
  }

  private async obterOuCriarModeloAssinatura(empresaInternaId: string) {
    const modelos = await this.contratosRepositorio.listarModelosPorEmpresa(empresaInternaId);
    const existente = modelos.find((m) => m.titulo === TITULO_MODELO_ASSINATURA);
    if (existente) return existente;

    return this.contratosRepositorio.criarModelo({
      empresaId: empresaInternaId,
      titulo: TITULO_MODELO_ASSINATURA,
      conteudoTemplate: TEMPLATE_MODELO_ASSINATURA,
      tipoConteudo: 'texto',
    });
  }
}
