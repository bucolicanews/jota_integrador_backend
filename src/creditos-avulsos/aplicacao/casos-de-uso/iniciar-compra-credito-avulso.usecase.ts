import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PagbankConfigService } from '../../../common/pagbank/pagbank-config.service';
import { CONTADORES_REPOSITORIO, ContadoresRepositorioPort } from '../../../contadores/aplicacao/portas/contadores-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import {
  PLANOS_REVENDA_CREDITOS_AVULSOS_REPOSITORIO,
  PlanosRevendaCreditosAvulsosRepositorioPort,
} from '../../../planos-revenda-creditos-avulsos/aplicacao/portas/planos-revenda-creditos-avulsos-repositorio.port';
import {
  CONFIGURACAO_CREDITOS_AVULSOS_REPOSITORIO,
  ConfiguracaoCreditosAvulsosRepositorioPort,
} from '../portas/configuracao-creditos-avulsos-repositorio.port';
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
  /** Exatamente um dos três: pacoteId = pacote direto da plataforma (sem split); planoRevendaId = pacote de revenda de um contador (com split); quantidade = quantidade livre (sem split), quantidade * valorPorCredito. */
  pacoteId?: string;
  planoRevendaId?: string;
  quantidade?: number;
  /** @default 'pix' */
  metodo?: 'pix' | 'cartao';
  /** Obrigatório quando metodo='cartao' -- PagSeguro.encryptCard() no navegador, nunca número/CVV em texto puro. */
  cardEncrypted?: string;
  installments?: number;
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
 * Inicia a cobrança PIX de um pacote de crédito avulso (top-up pontual). Dois caminhos
 * (ver creditos-avulsos.module.ts): `pacoteId` (direto da plataforma, sem split -- 100%
 * Jota) ou `planoRevendaId` (pacote de revenda de um contador específico -- split
 * contador+plataforma, mesmo mecanismo de IniciarPagamentoAtivacaoLicencaUseCase).
 * Créditos só entram quando o webhook confirmar (ProcessarWebhookCreditoAvulsoUseCase) --
 * nos dois caminhos, `pagamento.pacoteId` sempre aponta pro pacote-base real, então o
 * webhook credita igual sem precisar saber qual caminho foi usado.
 */
@Injectable()
export class IniciarCompraCreditoAvulsoUseCase {
  private readonly logger = new Logger(IniciarCompraCreditoAvulsoUseCase.name);

  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(PACOTES_CREDITOS_AVULSOS_REPOSITORIO) private readonly pacotesRepositorio: PacotesCreditosAvulsosRepositorioPort,
    @Inject(PAGAMENTOS_CREDITOS_AVULSOS_REPOSITORIO) private readonly pagamentosRepositorio: PagamentosCreditosAvulsosRepositorioPort,
    @Inject(PLANOS_REVENDA_CREDITOS_AVULSOS_REPOSITORIO) private readonly planosRevendaRepositorio: PlanosRevendaCreditosAvulsosRepositorioPort,
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
    @Inject(CONFIGURACAO_CREDITOS_AVULSOS_REPOSITORIO) private readonly configuracaoRepositorio: ConfiguracaoCreditosAvulsosRepositorioPort,
    private readonly pagbankConfig: PagbankConfigService,
  ) {}

  async executar(dados: DadosIniciarCompraCreditoAvulso): Promise<ResultadoIniciarCompraCreditoAvulso> {
    const escolhas = [dados.pacoteId, dados.planoRevendaId, dados.quantidade].filter((v) => v !== undefined && v !== null);
    if (escolhas.length !== 1) {
      throw new BadRequestException('Informe exatamente um dos três: pacoteId, planoRevendaId OU quantidade');
    }
    if (dados.metodo === 'cartao' && !dados.cardEncrypted) {
      throw new BadRequestException('cardEncrypted é obrigatório pra pagamento com cartão');
    }

    const empresa = await this.empresasRepositorio.buscarPorId(dados.empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }

    const pendenteExistente = await this.pagamentosRepositorio.obterPendentePorEmpresa(dados.empresaId);
    if (pendenteExistente) {
      throw new BadRequestException('Já existe uma compra de crédito pendente pra esta empresa');
    }

    if (dados.planoRevendaId) {
      return this.comprarViaRevenda(dados, empresa.razaoSocial, empresa.cnpj);
    }
    if (dados.quantidade) {
      return this.comprarQuantidadeLivre(dados, empresa.razaoSocial, empresa.cnpj);
    }
    return this.comprarDireto(dados, empresa.razaoSocial, empresa.cnpj);
  }

  /** PIX ou cartão (SDK JS no navegador, cardEncrypted já vem criptografado) -- mesmo payload-base nos dois casos, só o tipo de cobrança muda. */
  private async criarOrdem(client: any, dados: DadosIniciarCompraCreditoAvulso, params: Record<string, any>): Promise<any> {
    if (dados.metodo === 'cartao') {
      return client.criarOrdemCartao({ ...params, cardEncrypted: dados.cardEncrypted, installments: dados.installments });
    }
    return client.criarOrdemPix(params);
  }

  /** Pacote direto da plataforma -- SEM split, comportamento original preservado. */
  private async comprarDireto(
    dados: DadosIniciarCompraCreditoAvulso,
    razaoSocial: string,
    cnpj: string,
  ): Promise<ResultadoIniciarCompraCreditoAvulso> {
    const pacote = await this.pacotesRepositorio.buscarPorId(dados.pacoteId!);
    if (!pacote || !pacote.ativo) {
      throw new NotFoundException('Pacote de crédito não encontrado ou não está mais disponível');
    }

    const { client, webhookUrl } = await this.pagbankConfig.obterConfiguracaoSplit();

    const pagamento = await this.pagamentosRepositorio.criar({
      empresaId: dados.empresaId,
      pacoteId: dados.pacoteId!,
      quantidadeCreditos: pacote.quantidadeCreditos,
      valorTotal: pacote.precoReais,
    });

    const valorTotalCentavos = Math.round(pacote.precoReais * 100);

    let resposta: any;
    try {
      resposta = await this.criarOrdem(client, dados, {
        reference_id: `CREDITO_AVULSO_${pagamento.id}`,
        valor_centavos: valorTotalCentavos,
        customer: {
          name: razaoSocial,
          email: dados.customerEmail,
          tax_id: cnpj.replace(/\D/g, ''),
          phones: telefoneParaPagBank(dados.customerTelefoneE164),
        },
        itens: [{ name: `Créditos SERPRO: ${pacote.nome}`, quantity: 1, unit_amount: valorTotalCentavos }],
        webhook_url: webhookUrl,
        // Sem `splits` -- 100% da cobrança fica na conta PagBank da própria plataforma.
      });
    } catch (erro) {
      await this.pagamentosRepositorio.marcarFalhou(pagamento.id);
      this.logger.error(`Falha ao criar ordem PagBank (pagamento=${pagamento.id}): ${(erro as Error).message}`);
      throw new BadRequestException((erro as Error).message ?? 'Falha ao processar o pagamento na PagBank');
    }

    return this.finalizarPagamento(pagamento.id, resposta);
  }

  /** Pacote de revenda de um contador -- COM split (contador + plataforma). */
  private async comprarViaRevenda(
    dados: DadosIniciarCompraCreditoAvulso,
    razaoSocial: string,
    cnpj: string,
  ): Promise<ResultadoIniciarCompraCreditoAvulso> {
    const planoRevenda = await this.planosRevendaRepositorio.obterPorId(dados.planoRevendaId!);
    if (!planoRevenda || !planoRevenda.ativo) {
      throw new NotFoundException('Pacote de revenda não encontrado ou não está mais disponível');
    }

    const empresaDono = await this.empresasRepositorio.buscarPorId(dados.empresaId);
    if (!empresaDono || empresaDono.contadorId !== planoRevenda.contadorId) {
      throw new BadRequestException('Este pacote de revenda não pertence ao contador desta empresa');
    }

    const pacote = await this.pacotesRepositorio.buscarPorId(planoRevenda.pacoteId);
    if (!pacote || !pacote.ativo) {
      throw new NotFoundException('Pacote-base do plano de revenda não encontrado ou não está mais disponível');
    }

    const contador = await this.contadoresRepositorio.buscarPorId(planoRevenda.contadorId);
    if (!contador) {
      throw new NotFoundException('Contador do plano de revenda não encontrado');
    }
    if (!contador.pagbankAccountId) {
      throw new BadRequestException('O contador precisa cadastrar a conta PagBank antes de vender crédito avulso com split');
    }

    const { client, webhookUrl, splitHabilitado, platformAccountId } = await this.pagbankConfig.obterConfiguracaoSplit();
    if (!splitHabilitado) {
      throw new BadRequestException('Pagamentos com split estão temporariamente indisponíveis -- tente comprar direto da plataforma enquanto isso');
    }
    if (!platformAccountId) {
      throw new BadRequestException('Conta PagBank da plataforma não configurada -- contate o suporte');
    }

    const valorTotal = planoRevenda.valorVenda;
    const platformAmount = pacote.precoReais;
    const sellerAmount = valorTotal - platformAmount; // resto fica com o contador, absorve arredondamento

    const pagamento = await this.pagamentosRepositorio.criar({
      empresaId: dados.empresaId,
      pacoteId: planoRevenda.pacoteId,
      quantidadeCreditos: pacote.quantidadeCreditos,
      valorTotal,
      contadorId: planoRevenda.contadorId,
      planoRevendaId: planoRevenda.id,
      platformAmount,
      sellerAmount,
    });

    const valorTotalCentavos = Math.round(valorTotal * 100);
    const platformAmountCentavos = Math.round(platformAmount * 100);
    const sellerAmountCentavos = valorTotalCentavos - platformAmountCentavos;

    let resposta: any;
    try {
      resposta = await this.criarOrdem(client, dados, {
        reference_id: `CREDITO_AVULSO_${pagamento.id}`,
        valor_centavos: valorTotalCentavos,
        customer: {
          name: razaoSocial,
          email: dados.customerEmail,
          tax_id: cnpj.replace(/\D/g, ''),
          phones: telefoneParaPagBank(dados.customerTelefoneE164),
        },
        itens: [{ name: `Créditos SERPRO: ${planoRevenda.nome ?? pacote.nome}`, quantity: 1, unit_amount: valorTotalCentavos }],
        webhook_url: webhookUrl,
        splits: {
          method: 'FIXED',
          receivers: [
            { account: { id: contador.pagbankAccountId }, amount: { value: sellerAmountCentavos } },
            { account: { id: platformAccountId }, amount: { value: platformAmountCentavos } },
          ],
        },
      });
    } catch (erro) {
      await this.pagamentosRepositorio.marcarFalhou(pagamento.id);
      this.logger.error(`Falha ao criar ordem PagBank (pagamento=${pagamento.id}): ${(erro as Error).message}`);
      throw new BadRequestException((erro as Error).message ?? 'Falha ao processar o pagamento na PagBank');
    }

    return this.finalizarPagamento(pagamento.id, resposta);
  }

  /** Quantidade livre digitada pelo comprador -- SEM split (100% Jota, mesma regra do pacote direto), valorTotal = quantidade * valorPorCredito (configurado pelo admin). */
  private async comprarQuantidadeLivre(
    dados: DadosIniciarCompraCreditoAvulso,
    razaoSocial: string,
    cnpj: string,
  ): Promise<ResultadoIniciarCompraCreditoAvulso> {
    const quantidade = dados.quantidade!;
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw new BadRequestException('Quantidade precisa ser um número inteiro positivo');
    }

    const { valorPorCredito } = await this.configuracaoRepositorio.obter();
    const valorTotal = Math.round(quantidade * valorPorCredito * 100) / 100;

    const { client, webhookUrl } = await this.pagbankConfig.obterConfiguracaoSplit();

    const pagamento = await this.pagamentosRepositorio.criar({
      empresaId: dados.empresaId,
      pacoteId: null,
      quantidadeCreditos: quantidade,
      valorTotal,
    });

    const valorTotalCentavos = Math.round(valorTotal * 100);

    let resposta: any;
    try {
      resposta = await this.criarOrdem(client, dados, {
        reference_id: `CREDITO_AVULSO_${pagamento.id}`,
        valor_centavos: valorTotalCentavos,
        customer: {
          name: razaoSocial,
          email: dados.customerEmail,
          tax_id: cnpj.replace(/\D/g, ''),
          phones: telefoneParaPagBank(dados.customerTelefoneE164),
        },
        itens: [{ name: `${quantidade} créditos SERPRO`, quantity: 1, unit_amount: valorTotalCentavos }],
        webhook_url: webhookUrl,
        // Sem `splits` -- 100% da cobrança fica na conta PagBank da própria plataforma.
      });
    } catch (erro) {
      await this.pagamentosRepositorio.marcarFalhou(pagamento.id);
      this.logger.error(`Falha ao criar ordem PagBank (pagamento=${pagamento.id}): ${(erro as Error).message}`);
      throw new BadRequestException((erro as Error).message ?? 'Falha ao processar o pagamento na PagBank');
    }

    return this.finalizarPagamento(pagamento.id, resposta);
  }

  /**
   * PIX: devolve QR/código pro cliente escanear, crédito só entra via webhook. Cartão:
   * `capture:true` processa síncrono -- se a PagBank já devolveu DECLINED aqui, avisa na
   * hora em vez de deixar o usuário esperando um webhook que vai só confirmar o óbvio
   * (crédito em si continua só entrando via webhook nos dois casos -- mesma lógica,
   * nunca duplicada aqui).
   */
  private async finalizarPagamento(pagamentoId: string, resposta: any): Promise<ResultadoIniciarCompraCreditoAvulso> {
    const charge = resposta?.charges?.[0];
    const pixCode: string | null = charge?.qr_code?.text ?? null;
    const pixQrUrl: string | null = charge?.links?.find((l: any) => l.rel === 'QRCODE.PNG')?.href ?? null;

    await this.pagamentosRepositorio.definirDadosPix(pagamentoId, { pagbankOrderId: resposta.id, pixCode, pixQrUrl });

    if (charge?.status === 'DECLINED') {
      await this.pagamentosRepositorio.marcarFalhou(pagamentoId);
      const motivo = charge?.payment_response?.message ?? 'Cartão recusado';
      throw new BadRequestException(`Pagamento recusado: ${motivo}`);
    }

    return { pagamentoId, pixCode, pixQrUrl };
  }
}
