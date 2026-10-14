import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PagbankConfigService } from '../../../common/pagbank/pagbank-config.service';
import { CONTADORES_REPOSITORIO, ContadoresRepositorioPort } from '../../../contadores/aplicacao/portas/contadores-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { pacoteExpirado } from '../../../pacotes-modulos/dominio/pacote-modulos';
import { PACOTES_MODULOS_REPOSITORIO, PacotesModulosRepositorioPort } from '../../../pacotes-modulos/aplicacao/portas/pacotes-modulos-repositorio.port';
import {
  PLANOS_REVENDA_PACOTE_REPOSITORIO,
  PlanosRevendaPacoteRepositorioPort,
} from '../../../planos-revenda-pacote/aplicacao/portas/planos-revenda-pacote-repositorio.port';
import { podeAtivar } from '../../dominio/licenca-modulo';
import { LICENCAS_MODULO_REPOSITORIO, LicencasModuloRepositorioPort } from '../portas/licencas-modulo-repositorio.port';
import {
  PAGAMENTOS_ATIVACAO_LICENCA_REPOSITORIO,
  PagamentosAtivacaoLicencaRepositorioPort,
} from '../portas/pagamentos-ativacao-licenca-repositorio.port';

export interface DadosIniciarPagamentoAtivacao {
  licencaId: string;
  contadorId: string;
  empresaId: string;
  metodo: 'pix';
  customerEmail: string;
  customerTelefoneE164: string | null;
}

export interface ResultadoIniciarPagamento {
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
 * Inicia a cobrança PIX com split (plataforma fica com pacote.preco, contador com a
 * margem do plano de revenda dele) pra ativar um módulo numa empresa-cliente. A licença
 * SÓ é ativada quando o webhook confirmar o pagamento (ProcessarWebhookPagbankLicencaUseCase)
 * -- aqui só cria a "intenção de pagar".
 */
@Injectable()
export class IniciarPagamentoAtivacaoLicencaUseCase {
  private readonly logger = new Logger(IniciarPagamentoAtivacaoLicencaUseCase.name);

  constructor(
    @Inject(LICENCAS_MODULO_REPOSITORIO) private readonly licencasRepositorio: LicencasModuloRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(PACOTES_MODULOS_REPOSITORIO) private readonly pacotesRepositorio: PacotesModulosRepositorioPort,
    @Inject(PLANOS_REVENDA_PACOTE_REPOSITORIO) private readonly planosRevendaRepositorio: PlanosRevendaPacoteRepositorioPort,
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
    @Inject(PAGAMENTOS_ATIVACAO_LICENCA_REPOSITORIO) private readonly pagamentosRepositorio: PagamentosAtivacaoLicencaRepositorioPort,
    private readonly pagbankConfig: PagbankConfigService,
  ) {}

  async executar(dados: DadosIniciarPagamentoAtivacao): Promise<ResultadoIniciarPagamento> {
    const licenca = await this.licencasRepositorio.obterPorId(dados.licencaId);
    if (!licenca || licenca.contadorId !== dados.contadorId) {
      throw new NotFoundException('Licença não encontrada');
    }
    if (!podeAtivar(licenca.status)) {
      throw new BadRequestException(`Licença com status "${licenca.status}" não pode ser ativada`);
    }

    const pertence = await this.empresasRepositorio.pertenceAoContador(dados.empresaId, dados.contadorId);
    if (!pertence) {
      throw new NotFoundException('Empresa não encontrada na sua carteira');
    }

    const pacote = await this.pacotesRepositorio.obterPorId(licenca.pacoteId);
    if (!pacote) {
      throw new NotFoundException('Pacote da licença não encontrado');
    }
    if (pacoteExpirado(pacote.dataValidade)) {
      throw new BadRequestException('Pacote expirado -- não é possível ativar licença dele');
    }

    const planoRevenda = await this.planosRevendaRepositorio.obterAtivoPorContadorEPacote(dados.contadorId, licenca.pacoteId);
    if (!planoRevenda) {
      throw new BadRequestException('Cadastre seu plano de revenda deste pacote antes de ativar com cobrança');
    }

    const contador = await this.contadoresRepositorio.buscarPorId(dados.contadorId);
    if (!contador) {
      throw new NotFoundException('Contador não encontrado');
    }
    if (!contador.pagbankAccountId) {
      throw new BadRequestException('Cadastre sua conta PagBank antes de vender com cobrança real');
    }

    const { client, webhookUrl, splitHabilitado, platformAccountId } = await this.pagbankConfig.obterConfiguracaoSplit();
    if (!splitHabilitado) {
      throw new BadRequestException('Pagamentos com split estão temporariamente indisponíveis -- use a compra no atacado enquanto isso');
    }
    if (!platformAccountId) {
      throw new BadRequestException('Conta PagBank da plataforma não configurada -- contate o suporte');
    }

    const pendenteExistente = await this.pagamentosRepositorio.obterPendentePorLicenca(dados.licencaId);
    if (pendenteExistente) {
      throw new BadRequestException('Já existe um pagamento pendente pra esta licença');
    }

    const empresa = await this.empresasRepositorio.buscarPorId(dados.empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }

    const valorTotal = planoRevenda.valorVenda;
    const platformAmount = pacote.preco;
    const sellerAmount = valorTotal - platformAmount; // resto fica com o contador, absorve arredondamento

    const pagamento = await this.pagamentosRepositorio.criar({
      licencaId: dados.licencaId,
      contadorId: dados.contadorId,
      empresaId: dados.empresaId,
      planoRevendaId: planoRevenda.id,
      valorTotal,
      platformAmount,
      sellerAmount,
      metodo: dados.metodo,
    });

    const valorTotalCentavos = Math.round(valorTotal * 100);
    const platformAmountCentavos = Math.round(platformAmount * 100);
    const sellerAmountCentavos = valorTotalCentavos - platformAmountCentavos;

    let resposta: any;
    try {
      resposta = await client.criarOrdemPix({
        reference_id: `LICENCA_${pagamento.id}`,
        valor_centavos: valorTotalCentavos,
        customer: {
          name: empresa.razaoSocial,
          email: dados.customerEmail,
          tax_id: empresa.cnpj.replace(/\D/g, ''),
          phones: telefoneParaPagBank(dados.customerTelefoneE164),
        },
        itens: [{ name: `Ativação: ${pacote.nome}`, quantity: 1, unit_amount: valorTotalCentavos }],
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
