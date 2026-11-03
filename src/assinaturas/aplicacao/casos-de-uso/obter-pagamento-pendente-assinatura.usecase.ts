import { Inject, Injectable } from '@nestjs/common';
import {
  PAGAMENTOS_ASSINATURA_CREDITOS_REPOSITORIO,
  PagamentoAssinaturaCredito,
  PagamentosAssinaturaCreditosRepositorioPort,
} from '../portas/pagamentos-assinatura-creditos-repositorio.port';

/**
 * A empresa precisa ver (e poder reaproveitar) a cobrança que já foi gerada pra ela -- ex:
 * cadastro feito com "cliente paga depois" (ver CadastrarEmpresaComPlanoUseCase), ou
 * qualquer self-service que ela mesma começou e saiu antes de pagar. Sem isso, ela só via
 * "Nenhuma assinatura ainda" e, ao tentar gerar outra, batia no índice único de "1
 * pendente por empresa" sem nunca saber que já existia uma esperando.
 */
@Injectable()
export class ObterPagamentoPendenteAssinaturaUseCase {
  constructor(
    @Inject(PAGAMENTOS_ASSINATURA_CREDITOS_REPOSITORIO) private readonly repositorio: PagamentosAssinaturaCreditosRepositorioPort,
  ) {}

  async executar(empresaId: string): Promise<PagamentoAssinaturaCredito | null> {
    return this.repositorio.obterPendentePorEmpresa(empresaId);
  }
}
