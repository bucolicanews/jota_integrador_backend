import { Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CONTADORES_REPOSITORIO, ContadoresRepositorioPort } from '../../../contadores/aplicacao/portas/contadores-repositorio.port';
import { PACOTES_MODULOS_REPOSITORIO, PacotesModulosRepositorioPort } from '../../../pacotes-modulos/aplicacao/portas/pacotes-modulos-repositorio.port';
import { StripeLicencasService } from '../../infraestrutura/stripe-licencas.service';

export interface DadosCheckoutLicenca {
  contadorId: string;
  pacoteId: string;
  successUrl: string;
  cancelUrl: string;
}

/** Não cria a licença aqui -- só a Stripe confirmando o pagamento (webhook invoice.paid) cria de verdade, mesmo princípio de IniciarCheckoutAssinaturaUseCase. */
@Injectable()
export class IniciarCheckoutLicencaUseCase {
  private readonly logger = new Logger(IniciarCheckoutLicencaUseCase.name);

  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
    @Inject(PACOTES_MODULOS_REPOSITORIO) private readonly pacotesRepositorio: PacotesModulosRepositorioPort,
    private readonly stripe: StripeLicencasService,
  ) {}

  async executar(dados: DadosCheckoutLicenca): Promise<{ url: string }> {
    const contador = await this.contadoresRepositorio.buscarPorId(dados.contadorId);
    if (!contador) throw new NotFoundException('Contador não encontrado');

    const pacote = await this.pacotesRepositorio.obterPorId(dados.pacoteId);
    if (!pacote || !pacote.ativo) throw new NotFoundException('Pacote não encontrado ou não está mais disponível');

    try {
      let stripeCustomerId = contador.stripeCustomerId;
      if (!stripeCustomerId) {
        stripeCustomerId = await this.stripe.obterOuCriarCustomer(contador.id, contador.email, contador.nome);
        await this.contadoresRepositorio.atualizarStripeCustomerId(contador.id, stripeCustomerId);
      }

      return await this.stripe.criarCheckoutSession({
        customerId: stripeCustomerId,
        contadorId: contador.id,
        pacoteId: pacote.id,
        pacoteNome: pacote.nome,
        precoReais: pacote.preco,
        periodicidade: pacote.periodicidade,
        successUrl: dados.successUrl,
        cancelUrl: dados.cancelUrl,
      });
    } catch (erro) {
      this.logger.error(`Falha ao iniciar checkout de licença (contador=${contador.id}, pacote=${pacote.id}): ${(erro as Error).message}`);
      throw new InternalServerErrorException('Não foi possível iniciar o checkout de pagamento -- tente novamente em instantes');
    }
  }
}
