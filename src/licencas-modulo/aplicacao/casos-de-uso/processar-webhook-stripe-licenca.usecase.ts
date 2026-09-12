import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { UsuarioSistemaService } from '../../../common/usuario-sistema/usuario-sistema.service';
import { CriarContratoUseCase } from '../../../contratos/aplicacao/casos-de-uso/criar-contrato.usecase';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../../../contratos/aplicacao/portas/contratos-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { PACOTES_MODULOS_REPOSITORIO, PacotesModulosRepositorioPort } from '../../../pacotes-modulos/aplicacao/portas/pacotes-modulos-repositorio.port';
import { StripeLicencasService } from '../../infraestrutura/stripe-licencas.service';
import { LICENCAS_MODULO_REPOSITORIO, LicencasModuloRepositorioPort } from '../portas/licencas-modulo-repositorio.port';

const GATEWAY = 'stripe_licencas';

/** Empresa interna da própria Jota (tipo='interna_plataforma'), seed fixo na migration de licenciamento. */
const JOTA_EMPRESA_INTERNA_ID = '00000000-0000-0000-0000-000000000002';

const TITULO_MODELO_VENDA_ATACADO = 'Venda de Pacote no Atacado (padrão do sistema)';
const TEMPLATE_MODELO_VENDA_ATACADO =
  'Venda de licença de módulo(s) no atacado entre {{EMPRESA_RAZAO_SOCIAL}} e {{CLIENTE_NOME}}.\n\nPacote: conforme assinatura Stripe.\nValor: {{VALOR_TOTAL}} em {{QUANTIDADE_PARCELAS}}x.\nData: {{DATA_HOJE}}.';

/**
 * Mesma disciplina de ProcessarWebhookStripeAssinaturaUseCase: `invoice.paid` é a única
 * fonte de verdade pra "criar a licença disponível" (nunca checkout.session.completed,
 * sem garantia de ordem entre os dois). Idempotência via webhook_eventos_processados
 * (mesma tabela genérica, gateway='stripe_licencas' -- nunca cruza com 'stripe_assinaturas').
 */
@Injectable()
export class ProcessarWebhookStripeLicencaUseCase {
  private readonly logger = new Logger(ProcessarWebhookStripeLicencaUseCase.name);

  constructor(
    @Inject(LICENCAS_MODULO_REPOSITORIO) private readonly repositorio: LicencasModuloRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(PACOTES_MODULOS_REPOSITORIO) private readonly pacotesRepositorio: PacotesModulosRepositorioPort,
    @Inject(CONTRATOS_REPOSITORIO) private readonly contratosRepositorio: ContratosRepositorioPort,
    private readonly stripe: StripeLicencasService,
    private readonly auditoria: AuditoriaService,
    private readonly usuarioSistema: UsuarioSistemaService,
    private readonly criarContrato: CriarContratoUseCase,
  ) {}

  async executar(payloadBruto: Buffer, assinaturaHeader: string): Promise<void> {
    const event = this.stripe.construirEvento(payloadBruto, assinaturaHeader);

    if (await this.repositorio.jaProcessouEventoWebhook(GATEWAY, event.id)) {
      this.logger.log(`Evento ${event.id} (${event.type}) já processado -- ignorando (idempotência).`);
      return;
    }

    switch (event.type) {
      case 'invoice.paid':
        await this.tratarFaturaPaga(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.deleted':
        await this.tratarAssinaturaCancelada(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }

    await this.repositorio.marcarEventoWebhookProcessado(GATEWAY, event.id);
  }

  private async tratarFaturaPaga(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubscriptionId = this.extrairSubscriptionId(invoice);
    if (!stripeSubscriptionId) {
      this.logger.warn(`invoice.paid (${invoice.id}) sem subscription -- ignorando.`);
      return;
    }

    // Já existe licença pra essa subscription? Fatura de RENOVAÇÃO (2º mês em diante) não
    // deve criar um assento novo -- só a 1ª fatura da subscription vira uma licença.
    const jaExiste = await this.repositorio.buscarPorStripeSubscriptionId(stripeSubscriptionId);
    if (jaExiste) {
      this.logger.log(`Subscription ${stripeSubscriptionId} já tem licença (renovação) -- nada a criar.`);
      return;
    }

    let metadata: { contadorId: string; pacoteId: string } | null = null;
    try {
      metadata = await this.stripe.obterMetadataSubscription(stripeSubscriptionId);
    } catch (erro) {
      this.logger.error(`Falha ao consultar subscription ${stripeSubscriptionId} na Stripe: ${(erro as Error).message}`);
    }
    if (!metadata) {
      this.logger.error(`invoice.paid (${invoice.id}) pra subscription ${stripeSubscriptionId} sem metadata -- não dá pra saber de qual contador/pacote é.`);
      return;
    }

    const licenca = await this.repositorio.criar({ contadorId: metadata.contadorId, pacoteId: metadata.pacoteId, stripeSubscriptionId });

    await this.auditoria.registrar({
      usuarioId: null,
      contadorId: metadata.contadorId,
      acao: 'licenca_modulo.comprada',
      recurso: 'licencas_modulo',
      dadosNovos: { licencaId: licenca.id, pacoteId: metadata.pacoteId, stripeInvoiceId: invoice.id },
    });

    // Já cobrado de verdade via Stripe -- isso só registra a venda nos livros de cada lado
    // (receita da Jota / despesa do contador), mesmo mecanismo cross-empresa usado quando o
    // contador ativa uma licença numa empresa (CriarContratoUseCase + emitir_cobranca_interna),
    // só invertendo quem é emissor/contraparte um nível acima.
    const valorPago = invoice.amount_paid != null ? invoice.amount_paid / 100 : 0;
    if (valorPago > 0) {
      await this.registrarVendaAtacado(metadata.contadorId, metadata.pacoteId, valorPago, licenca.id);
    }
  }

  private async registrarVendaAtacado(contadorId: string, pacoteId: string, valorPago: number, licencaId: string): Promise<void> {
    const empresaInternaContador = await this.empresasRepositorio.buscarEmpresaInternaDoContador(contadorId);
    if (!empresaInternaContador) {
      this.logger.error(`Contador ${contadorId} sem empresa interna -- não foi possível registrar a venda de atacado da licença ${licencaId} nos livros.`);
      return;
    }

    const pacote = await this.pacotesRepositorio.obterPorId(pacoteId);
    if (!pacote) {
      this.logger.error(`Pacote ${pacoteId} não encontrado -- não foi possível registrar a venda de atacado da licença ${licencaId} nos livros.`);
      return;
    }

    const modelo = await this.obterOuCriarModeloVendaAtacado();
    const executadoPor = await this.usuarioSistema.obterOuCriarId();

    await this.criarContrato.executar({
      empresaId: JOTA_EMPRESA_INTERNA_ID,
      modeloId: modelo.id,
      clienteId: null,
      empresaContraparteId: empresaInternaContador.id,
      titulo: `Licença (atacado): ${pacote.nome}`,
      valoresTagsManuais: {},
      valorTotal: valorPago,
      parcelamento: { modo: 'unico', quantidadeParcelas: 1, primeiroVencimento: new Date().toISOString().slice(0, 10), intervaloDias: 30 },
      criadoPor: executadoPor,
    });
  }

  private async obterOuCriarModeloVendaAtacado() {
    const modelos = await this.contratosRepositorio.listarModelosPorEmpresa(JOTA_EMPRESA_INTERNA_ID);
    const existente = modelos.find((m) => m.titulo === TITULO_MODELO_VENDA_ATACADO);
    if (existente) return existente;
    return this.contratosRepositorio.criarModelo({
      empresaId: JOTA_EMPRESA_INTERNA_ID,
      titulo: TITULO_MODELO_VENDA_ATACADO,
      conteudoTemplate: TEMPLATE_MODELO_VENDA_ATACADO,
      tipoConteudo: 'texto',
    });
  }

  private async tratarAssinaturaCancelada(subscription: Stripe.Subscription): Promise<void> {
    const licenca = await this.repositorio.buscarPorStripeSubscriptionId(subscription.id);
    if (!licenca) {
      this.logger.warn(`customer.subscription.deleted pra subscription ${subscription.id} sem licença local -- ignorando.`);
      return;
    }

    await this.repositorio.cancelar(licenca.id);

    await this.auditoria.registrar({
      usuarioId: null,
      contadorId: licenca.contadorId,
      acao: 'licenca_modulo.cancelada',
      recurso: 'licencas_modulo',
      dadosAntigos: { licencaId: licenca.id, status: licenca.status },
    });
  }

  private extrairSubscriptionId(invoice: Stripe.Invoice): string | null {
    const bruto = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
    if (!bruto) return null;
    return typeof bruto === 'string' ? bruto : bruto.id;
  }
}
