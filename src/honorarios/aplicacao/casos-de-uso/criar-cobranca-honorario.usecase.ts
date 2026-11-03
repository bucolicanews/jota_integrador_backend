import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PagbankConfigService } from '../../../common/pagbank/pagbank-config.service';
import {
  CONTADORES_REPOSITORIO,
  ContadoresRepositorioPort,
} from '../../../contadores/aplicacao/portas/contadores-repositorio.port';
import {
  EMPRESAS_REPOSITORIO,
  EmpresasRepositorioPort,
} from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { validarValorCobranca } from '../../dominio/cobranca-honorario';
import {
  CobrancaHonorario,
  COBRANCAS_HONORARIOS_REPOSITORIO,
  CobrancasHonorariosRepositorioPort,
} from '../portas/cobrancas-honorarios-repositorio.port';

export interface DadosCriarCobranca {
  contadorId: string;
  empresaId: string;
  descricao: string;
  valor: number;
  metodo: 'pix' | 'cartao';
  /** Obrigatório quando metodo='cartao' -- PagSeguro.encryptCard() no navegador, nunca número/CVV em texto puro. */
  cardEncrypted?: string;
  installments?: number;
  customerEmail: string;
  customerTelefoneE164?: string;
}

export interface ResultadoCriarCobranca {
  cobranca: CobrancaHonorario;
  pixCode: string | null;
  pixQrUrl: string | null;
}

function telefoneParaPagBank(telefoneE164: string | undefined): { country: string; area: string; number: string; type: 'MOBILE' }[] | undefined {
  if (!telefoneE164) return undefined;
  const digitos = telefoneE164.replace(/\D/g, '');
  if (digitos.length < 12) return undefined; // +55(2) + DDD(2) + número(8/9)
  return [{ country: digitos.slice(0, 2), area: digitos.slice(2, 4), number: digitos.slice(4), type: 'MOBILE' }];
}

/**
 * Cria a cobrança de honorário (empresa paga o contador, Jota comissiona) com split
 * PagBank -- mesmo mecanismo já em produção em assinatura-créditos/créditos-avulsos/
 * licença-ativação, agora sem o onboarding Connect: o contador já cadastra o próprio
 * pagbank_account_id em PATCH /contadores/:id/pagbank-conta. A cobrança SÓ fica 'pago'
 * quando o webhook confirmar (ProcessarWebhookPagbankHonorarioUseCase).
 */
@Injectable()
export class CriarCobrancaHonorarioUseCase {
  private readonly logger = new Logger(CriarCobrancaHonorarioUseCase.name);

  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(COBRANCAS_HONORARIOS_REPOSITORIO)
    private readonly cobrancasRepositorio: CobrancasHonorariosRepositorioPort,
    private readonly pagbankConfig: PagbankConfigService,
  ) {}

  async executar(dados: DadosCriarCobranca): Promise<ResultadoCriarCobranca> {
    try {
      validarValorCobranca(dados.valor);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }
    if (dados.metodo === 'cartao' && !dados.cardEncrypted) {
      throw new BadRequestException('cardEncrypted é obrigatório pra pagamento com cartão');
    }

    const contador = await this.contadoresRepositorio.buscarPorId(dados.contadorId);
    if (!contador) {
      throw new NotFoundException('Contador não encontrado');
    }

    // Isolamento obrigatório antes de qualquer ordem PagBank (docs/SEGURANCA.md §7) --
    // duplicando aqui o que `valida_posse_cobranca_honorario` já garante no banco
    // (defesa em profundidade, mesma regra de Zero Trust do resto do projeto).
    const pertenceACarteira = await this.empresasRepositorio.pertenceAoContador(dados.empresaId, dados.contadorId);
    if (!pertenceACarteira) {
      throw new ForbiddenException('Esta empresa não pertence à carteira deste contador');
    }

    // Nunca mostrar opção de pagamento se a conta do contador não pode receber ainda
    // (docs/SEGURANCA.md §7: gating no backend, não só no frontend).
    if (!contador.pagbankAccountId) {
      throw new BadRequestException('Cadastre sua conta PagBank antes de cobrar honorário com split real');
    }

    const empresa = await this.empresasRepositorio.buscarPorId(dados.empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }

    const { client, webhookUrl, splitHabilitado, platformAccountId } = await this.pagbankConfig.obterConfiguracaoSplit('honorarios');
    if (!splitHabilitado) {
      throw new BadRequestException('Pagamentos com split estão temporariamente indisponíveis -- tente novamente mais tarde');
    }
    if (!platformAccountId) {
      throw new BadRequestException('Conta PagBank da plataforma não configurada -- contate o suporte');
    }

    // Comissão é calculada pelo trigger do banco (definir_comissao_honorario), a partir
    // da config global -- nunca aceita do cliente nem calculada aqui.
    const cobranca = await this.cobrancasRepositorio.criar({
      contadorId: dados.contadorId,
      empresaId: dados.empresaId,
      descricao: dados.descricao,
      valor: dados.valor,
      metodo: dados.metodo,
    });

    const valorTotalCentavos = Math.round(cobranca.valor * 100);
    const comissaoValorCentavos = Math.round(cobranca.comissaoValor * 100);
    const sellerAmountCentavos = valorTotalCentavos - comissaoValorCentavos; // resto fica com o contador, absorve arredondamento

    const params = {
      reference_id: `HONORARIO_${cobranca.id}`,
      valor_centavos: valorTotalCentavos,
      customer: {
        name: empresa.razaoSocial,
        email: dados.customerEmail,
        tax_id: empresa.cnpj.replace(/\D/g, ''),
        phones: telefoneParaPagBank(dados.customerTelefoneE164),
      },
      itens: [{ name: `Honorário: ${dados.descricao}`, quantity: 1, unit_amount: valorTotalCentavos }],
      webhook_url: webhookUrl,
      splits: {
        method: 'FIXED' as const,
        receivers: [
          { account: { id: contador.pagbankAccountId }, amount: { value: sellerAmountCentavos } },
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
      // Marca falhou antes de propagar -- não deixa a cobrança 'pendente' sem nenhuma
      // ordem PagBank associada (mesmo tratamento das outras 4 cobranças com split).
      await this.cobrancasRepositorio.marcarFalhou(cobranca.id);
      this.logger.error(`Falha ao criar ordem PagBank (cobrança=${cobranca.id}): ${(erro as Error).message}`);
      throw new BadRequestException((erro as Error).message ?? 'Não foi possível iniciar o pagamento -- tente novamente em instantes');
    }

    const charge = resposta?.charges?.[0];
    const pixCode: string | null = charge?.qr_code?.text ?? null;
    const pixQrUrl: string | null = charge?.links?.find((l: any) => l.rel === 'QRCODE.PNG')?.href ?? null;

    await this.cobrancasRepositorio.definirDadosPix(cobranca.id, { pagbankOrderId: resposta.id, pixCode, pixQrUrl });

    // Cartão processa síncrono (capture:true) -- se já veio DECLINED, avisa na hora em vez
    // de deixar o usuário esperando um webhook que só confirmaria o óbvio (mesmo
    // tratamento de IniciarCompraCreditoAvulsoUseCase/IniciarPagamentoAssinaturaCreditosUseCase).
    if (charge?.status === 'DECLINED') {
      await this.cobrancasRepositorio.marcarFalhou(cobranca.id);
      const motivo = charge?.payment_response?.message ?? 'Cartão recusado';
      throw new BadRequestException(`Pagamento recusado: ${motivo}`);
    }

    return { cobranca, pixCode, pixQrUrl };
  }
}
