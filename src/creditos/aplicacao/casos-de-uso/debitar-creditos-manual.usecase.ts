import { Inject, Injectable } from '@nestjs/common';
import { CREDITOS_REPOSITORIO, CreditosRepositorioPort } from '../portas/creditos-repositorio.port';

/**
 * Retirar créditos manualmente (admin/contador) -- simétrico a CreditarCreditosUseCase.
 * Diferente de DebitarCreditosUseCase (usado pelo serpro/ antes de uma operação paga),
 * aqui a quantidade vem explícita do chamador, não do catálogo custoDaOperacao -- é um
 * ajuste administrativo, não o custo de uma operação real.
 */
@Injectable()
export class DebitarCreditosManualUseCase {
  constructor(
    @Inject(CREDITOS_REPOSITORIO) private readonly creditosRepositorio: CreditosRepositorioPort,
  ) {}

  async executar(contadorId: string, empresaId: string, quantidade: number, motivo: string): Promise<number> {
    return this.creditosRepositorio.debitar(contadorId, empresaId, 'AJUSTE_MANUAL', quantidade, motivo);
  }
}
