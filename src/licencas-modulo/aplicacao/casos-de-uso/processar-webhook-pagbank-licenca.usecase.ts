import { Inject, Injectable, Logger } from '@nestjs/common';
import { PagbankConfigService } from '../../../common/pagbank/pagbank-config.service';
import { UsuarioSistemaService } from '../../../common/usuario-sistema/usuario-sistema.service';
import { CriarContratoUseCase } from '../../../contratos/aplicacao/casos-de-uso/criar-contrato.usecase';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../../../contratos/aplicacao/portas/contratos-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { LICENCAS_MODULO_REPOSITORIO, LicencasModuloRepositorioPort } from '../portas/licencas-modulo-repositorio.port';
import {
  PAGAMENTOS_ATIVACAO_LICENCA_REPOSITORIO,
  PagamentosAtivacaoLicencaRepositorioPort,
} from '../portas/pagamentos-ativacao-licenca-repositorio.port';

const STATUS_PAGOS = ['PAID', 'COMPLETED', 'AVAILABLE'];
const TITULO_MODELO_ATIVACAO = 'Ativação de Licença de Módulo (padrão do sistema)';
const TEMPLATE_MODELO_ATIVACAO =
  'Contrato de licenciamento de módulo entre {{EMPRESA_RAZAO_SOCIAL}} e {{CLIENTE_NOME}}.\n\nMódulo(s) licenciado(s): conforme pacote contratado.\nValor: {{VALOR_TOTAL}} em {{QUANTIDADE_PARCELAS}}x.\nData: {{DATA_HOJE}}.';

/**
 * PagBank NÃO assina notificações -- nunca confiar no status vindo no corpo do POST.
 * Reconsulta a ordem via API (autoritativa) antes de ativar qualquer coisa. Idempotência
 * pelo status LOCAL (pagamentos_ativacao_licenca.status), não pela tabela genérica
 * webhook_eventos_processados (desenhada pra eventos assinados com id estável -- PagBank
 * não garante nenhum dos dois).
 */
@Injectable()
export class ProcessarWebhookPagbankLicencaUseCase {
  private readonly logger = new Logger(ProcessarWebhookPagbankLicencaUseCase.name);

  constructor(
    @Inject(PAGAMENTOS_ATIVACAO_LICENCA_REPOSITORIO) private readonly pagamentosRepositorio: PagamentosAtivacaoLicencaRepositorioPort,
    @Inject(LICENCAS_MODULO_REPOSITORIO) private readonly licencasRepositorio: LicencasModuloRepositorioPort,
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
    await this.licencasRepositorio.ativar(pagamento.licencaId, pagamento.empresaId);
    await this.registrarContabilmente(pagamento);

    return { processado: true };
  }

  /** Dinheiro já se moveu via PagBank -- isto só espelha nos livros de cada lado (mesmo papel de registrarVendaAtacado no webhook Stripe de licença). */
  private async registrarContabilmente(pagamento: {
    contadorId: string;
    empresaId: string;
    valorTotal: number;
  }): Promise<void> {
    const empresaInterna = await this.empresasRepositorio.buscarEmpresaInternaDoContador(pagamento.contadorId);
    if (!empresaInterna) {
      this.logger.error(`Contador ${pagamento.contadorId} sem empresa interna -- não foi possível registrar o pagamento de ativação nos livros.`);
      return;
    }

    const modelo = await this.obterOuCriarModeloAtivacao(empresaInterna.id);
    const executadoPor = await this.usuarioSistema.obterOuCriarId();

    await this.criarContrato.executar({
      empresaId: empresaInterna.id,
      modeloId: modelo.id,
      clienteId: null,
      empresaContraparteId: pagamento.empresaId,
      titulo: 'Ativação de pacote (pago via PagBank)',
      valoresTagsManuais: {},
      valorTotal: pagamento.valorTotal,
      parcelamento: { modo: 'unico', quantidadeParcelas: 1, primeiroVencimento: new Date().toISOString().slice(0, 10), intervaloDias: 30 },
      criadoPor: executadoPor,
    });
  }

  private async obterOuCriarModeloAtivacao(empresaInternaId: string) {
    const modelos = await this.contratosRepositorio.listarModelosPorEmpresa(empresaInternaId);
    const existente = modelos.find((m) => m.titulo === TITULO_MODELO_ATIVACAO);
    if (existente) return existente;

    return this.contratosRepositorio.criarModelo({
      empresaId: empresaInternaId,
      titulo: TITULO_MODELO_ATIVACAO,
      conteudoTemplate: TEMPLATE_MODELO_ATIVACAO,
      tipoConteudo: 'texto',
    });
  }
}
