import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CLIENTES_REPOSITORIO, ClientesRepositorioPort } from '../../../clientes/aplicacao/portas/clientes-repositorio.port';
import {
  CONTAS_RECEBER_REPOSITORIO,
  ContasReceberRepositorioPort,
} from '../../../contas-a-receber/aplicacao/portas/contas-receber-repositorio.port';
import { PagbankConfigService } from '../../../common/pagbank/pagbank-config.service';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { validarValorLinkPagamento } from '../../dominio/link-pagamento-parcela';
import {
  LINKS_PAGAMENTO_PARCELA_REPOSITORIO,
  LinkPagamentoParcela,
  LinksPagamentoParcelaRepositorioPort,
} from '../portas/links-pagamento-parcela-repositorio.port';

export interface DadosGerarLinkPagamento {
  empresaId: string;
  parcelaId: string;
  metodo: 'pix' | 'cartao';
  /** Obrigatório quando metodo='cartao' -- PagSeguro.encryptCard() no navegador, nunca número/CVV em texto puro. */
  cardEncrypted?: string;
  installments?: number;
  criadoPor: string;
}

export interface ResultadoGerarLinkPagamento {
  link: LinkPagamentoParcela;
  pixCode: string | null;
  pixQrUrl: string | null;
}

/**
 * Gera um link de pagamento PagBank com split pra uma parcela de contas_receber --
 * mesmo mecanismo já em produção em honorários/créditos-avulsos/assinatura-créditos/
 * licença atacado, agora pra QUALQUER empresa credora (contador cobrando cliente dele,
 * empresa-cliente cobrando o próprio cliente, ou admin cobrando cliente direto da
 * plataforma): a empresa fica com o valor líquido, a Jota com a comissão de contratos.
 * Só fica 'pago' quando o webhook confirmar (ProcessarWebhookPagbankParcelaUseCase).
 */
@Injectable()
export class GerarLinkPagamentoParcelaUseCase {
  private readonly logger = new Logger(GerarLinkPagamentoParcelaUseCase.name);

  constructor(
    @Inject(CONTAS_RECEBER_REPOSITORIO) private readonly contasReceberRepositorio: ContasReceberRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(CLIENTES_REPOSITORIO) private readonly clientesRepositorio: ClientesRepositorioPort,
    @Inject(LINKS_PAGAMENTO_PARCELA_REPOSITORIO)
    private readonly linksRepositorio: LinksPagamentoParcelaRepositorioPort,
    private readonly pagbankConfig: PagbankConfigService,
  ) {}

  async executar(dados: DadosGerarLinkPagamento): Promise<ResultadoGerarLinkPagamento> {
    if (dados.metodo === 'cartao' && !dados.cardEncrypted) {
      throw new BadRequestException('cardEncrypted é obrigatório pra pagamento com cartão');
    }

    const parcela = await this.contasReceberRepositorio.obterParcela(dados.parcelaId);
    if (!parcela || parcela.empresaId !== dados.empresaId) {
      throw new NotFoundException('Parcela não encontrada');
    }
    if (parcela.cancelada || parcela.status === 'cancelada') {
      throw new BadRequestException('Parcela cancelada não pode gerar link de pagamento');
    }
    if (parcela.status === 'recebida') {
      throw new BadRequestException('Parcela já está totalmente recebida');
    }

    const restante = Math.round((parcela.valorParcela - parcela.valorRecebido) * 100) / 100;
    try {
      validarValorLinkPagamento(restante);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }

    const conta = await this.contasReceberRepositorio.obterPorId(parcela.contaReceberId);
    if (!conta) throw new NotFoundException('Conta a receber não encontrada');

    const empresa = await this.empresasRepositorio.buscarPorId(dados.empresaId);
    if (!empresa) throw new NotFoundException('Empresa não encontrada');

    // Nunca mostrar opção de link se a conta/banco da empresa não estiverem prontos
    // (docs/SEGURANCA.md §7: gating no backend, não só no frontend) -- sem banco_pagbank_id
    // o webhook não teria onde lançar o recebimento depois.
    if (!empresa.pagbankAccountId) {
      throw new BadRequestException('Cadastre a conta PagBank da empresa antes de gerar link de pagamento com split real');
    }
    if (!empresa.bancoPagbankId) {
      throw new BadRequestException('Escolha o banco padrão de recebimento PagBank da empresa antes de gerar o link');
    }

    if (!conta.clienteId) {
      throw new BadRequestException('Esta conta a receber não tem um cliente cadastrado -- cadastre o cliente (com CPF/CNPJ e e-mail) antes de gerar o link');
    }
    const cliente = await this.clientesRepositorio.obterPorId(conta.clienteId);
    if (!cliente || !cliente.documento || !cliente.email) {
      throw new BadRequestException('O cliente desta conta a receber precisa ter CPF/CNPJ e e-mail cadastrados antes de gerar o link');
    }

    const { client, webhookUrl, splitHabilitado, platformAccountId } = await this.pagbankConfig.obterConfiguracaoSplit(
      'parcelas-contas-receber',
    );
    if (!splitHabilitado) {
      throw new BadRequestException('Pagamentos com split estão temporariamente indisponíveis -- tente novamente mais tarde');
    }
    if (!platformAccountId) {
      throw new BadRequestException('Conta PagBank da plataforma não configurada -- contate o suporte');
    }

    // Comissão é calculada pelo trigger do banco (definir_comissao_link_pagamento_parcela),
    // a partir da config global -- nunca aceita do cliente nem calculada aqui.
    const link = await this.linksRepositorio.criar({
      parcelaId: dados.parcelaId,
      empresaId: dados.empresaId,
      clienteId: cliente.id,
      valor: restante,
      metodo: dados.metodo,
      criadoPor: dados.criadoPor,
    });

    const valorTotalCentavos = Math.round(link.valor * 100);
    const comissaoValorCentavos = Math.round(link.comissaoValor * 100);
    const sellerAmountCentavos = valorTotalCentavos - comissaoValorCentavos; // resto fica com a empresa, absorve arredondamento

    const params = {
      reference_id: `LINK_PARCELA_${link.id}`,
      valor_centavos: valorTotalCentavos,
      customer: {
        name: cliente.razaoSocial || cliente.nome,
        email: cliente.email,
        tax_id: cliente.documento.replace(/\D/g, ''),
        phones: telefoneParaPagBank(cliente.telefone),
      },
      itens: [{ name: `${conta.descricao} -- parcela ${parcela.numeroParcela}`, quantity: 1, unit_amount: valorTotalCentavos }],
      webhook_url: webhookUrl,
      splits: {
        method: 'FIXED' as const,
        receivers: [
          { account: { id: empresa.pagbankAccountId }, amount: { value: sellerAmountCentavos } },
          { account: { id: platformAccountId }, amount: { value: comissaoValorCentavos } },
        ],
      },
    };

    let resposta: any;
    try {
      resposta =
        dados.metodo === 'cartao'
          ? await client.criarOrdemCartao({ ...params, cardEncrypted: dados.cardEncrypted!, installments: dados.installments })
          : await client.criarOrdemPix(params);
    } catch (erro) {
      // Marca falhou antes de propagar -- não deixa o link 'pendente' sem nenhuma ordem
      // PagBank associada (mesmo tratamento das outras cobranças com split).
      await this.linksRepositorio.marcarFalhou(link.id);
      this.logger.error(`Falha ao criar ordem PagBank (link=${link.id}): ${(erro as Error).message}`);
      throw new BadRequestException((erro as Error).message ?? 'Não foi possível gerar o link de pagamento -- tente novamente em instantes');
    }

    const charge = resposta?.charges?.[0];
    const pixCode: string | null = charge?.qr_code?.text ?? null;
    const pixQrUrl: string | null = charge?.links?.find((l: any) => l.rel === 'QRCODE.PNG')?.href ?? null;

    await this.linksRepositorio.definirDadosPix(link.id, { pagbankOrderId: resposta.id, pixCode, pixQrUrl });

    if (charge?.status === 'DECLINED') {
      await this.linksRepositorio.marcarFalhou(link.id);
      const motivo = charge?.payment_response?.message ?? 'Cartão recusado';
      throw new BadRequestException(`Pagamento recusado: ${motivo}`);
    }

    return { link, pixCode, pixQrUrl };
  }
}

function telefoneParaPagBank(telefone: string | null): { country: string; area: string; number: string; type: 'MOBILE' }[] | undefined {
  const digitos = (telefone ?? '').replace(/\D/g, '');
  if (digitos.length < 10) return undefined;
  // Mesmo tratamento de criar-cobranca-honorario.usecase.ts -- aceita com ou sem DDI 55.
  const comDdi = digitos.length <= 11 ? `55${digitos}` : digitos;
  if (comDdi.length < 12) return undefined;
  return [{ country: comDdi.slice(0, 2), area: comDdi.slice(2, 4), number: comDdi.slice(4), type: 'MOBILE' }];
}
