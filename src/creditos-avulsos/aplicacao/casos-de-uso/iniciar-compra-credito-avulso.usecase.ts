import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PagbankConfigService } from '../../../common/pagbank/pagbank-config.service';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import {
  PACOTES_CREDITOS_AVULSOS_REPOSITORIO,
  PacotesCreditosAvulsosRepositorioPort,
} from '../portas/pacotes-creditos-avulsos-repositorio.port';
import {
  PAGAMENTOS_CREDITOS_AVULSOS_REPOSITORIO,
  PagamentosCreditosAvulsosRepositorioPort,
} from '../portas/pagamentos-creditos-avulsos-repositorio.port';

export interface DadosIniciarCompraCreditoAvulso {
  empresaId: string;
  pacoteId: string;
  customerEmail: string;
  customerTelefoneE164: string | null;
}

export interface ResultadoIniciarCompraCreditoAvulso {
  pagamentoId: string;
  pixCode: string | null;
  pixQrUrl: string | null;
}

function telefoneParaPagBank(telefoneE164: string | null): { country: string; area: string; number: string; type: 'MOBILE' }[] | undefined {
  if (!telefoneE164) return undefined;
  const digitos = telefoneE164.replace(/\D/g, '');
  if (digitos.length < 12) return undefined; // +55(2) + DDD(2) + número(8/9)
  return [{ country: digitos.slice(0, 2), area: digitos.slice(2, 4), number: digitos.slice(4), type: 'MOBILE' }];
}

/**
 * Inicia a cobrança PIX de um pacote de crédito avulso (top-up pontual) -- SEM split: o
 * valor cai 100% na conta PagBank da própria plataforma (Jota), nenhuma fatia pro
 * contador, diferente de IniciarPagamentoAssinaturaCreditosUseCase. A empresa pode
 * comprar pra si mesma, ou o contador dela pode iniciar em nome dela -- ver posse no
 * controller. Créditos só entram quando o webhook confirmar (ProcessarWebhookCreditoAvulsoUseCase).
 */
@Injectable()
export class IniciarCompraCreditoAvulsoUseCase {
  private readonly logger = new Logger(IniciarCompraCreditoAvulsoUseCase.name);

  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(PACOTES_CREDITOS_AVULSOS_REPOSITORIO) private readonly pacotesRepositorio: PacotesCreditosAvulsosRepositorioPort,
    @Inject(PAGAMENTOS_CREDITOS_AVULSOS_REPOSITORIO) private readonly pagamentosRepositorio: PagamentosCreditosAvulsosRepositorioPort,
    private readonly pagbankConfig: PagbankConfigService,
  ) {}

  async executar(dados: DadosIniciarCompraCreditoAvulso): Promise<ResultadoIniciarCompraCreditoAvulso> {
    const empresa = await this.empresasRepositorio.buscarPorId(dados.empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }

    const pacote = await this.pacotesRepositorio.buscarPorId(dados.pacoteId);
    if (!pacote || !pacote.ativo) {
      throw new NotFoundException('Pacote de crédito não encontrado ou não está mais disponível');
    }

    const { client, webhookUrl } = await this.pagbankConfig.obterConfiguracaoSplit();

    const pendenteExistente = await this.pagamentosRepositorio.obterPendentePorEmpresa(dados.empresaId);
    if (pendenteExistente) {
      throw new BadRequestException('Já existe uma compra de crédito pendente pra esta empresa');
    }

    const pagamento = await this.pagamentosRepositorio.criar({
      empresaId: dados.empresaId,
      pacoteId: dados.pacoteId,
      valorTotal: pacote.precoReais,
    });

    const valorTotalCentavos = Math.round(pacote.precoReais * 100);

    let resposta: any;
    try {
      resposta = await client.criarOrdemPix({
        reference_id: `CREDITO_AVULSO_${pagamento.id}`,
        valor_centavos: valorTotalCentavos,
        customer: {
          name: empresa.razaoSocial,
          email: dados.customerEmail,
          tax_id: empresa.cnpj.replace(/\D/g, ''),
          phones: telefoneParaPagBank(dados.customerTelefoneE164),
        },
        itens: [{ name: `Créditos SERPRO: ${pacote.nome}`, quantity: 1, unit_amount: valorTotalCentavos }],
        webhook_url: webhookUrl,
        // Sem `splits` -- 100% da cobrança fica na conta PagBank da própria plataforma.
      });
    } catch (erro) {
      await this.pagamentosRepositorio.marcarFalhou(pagamento.id);
      this.logger.error(`Falha ao criar ordem PIX PagBank (pagamento=${pagamento.id}): ${(erro as Error).message}`);
      throw new BadRequestException((erro as Error).message ?? 'Falha ao gerar o PIX na PagBank');
    }

    const charge = resposta?.charges?.[0];
    const pixCode: string | null = charge?.qr_code?.text ?? null;
    const pixQrUrl: string | null = charge?.links?.find((l: any) => l.rel === 'QRCODE.PNG')?.href ?? null;

    await this.pagamentosRepositorio.definirDadosPix(pagamento.id, { pagbankOrderId: resposta.id, pixCode, pixQrUrl });

    return { pagamentoId: pagamento.id, pixCode, pixQrUrl };
  }
}
