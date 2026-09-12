import { Inject, Injectable } from '@nestjs/common';
import { CONCILIACAO_REPOSITORIO, ConciliacaoRepositorioPort, TransacaoConciliacao } from '../portas/conciliacao-repositorio.port';

/** Tela de Pendências (equivalente a `Mapeamento.tsx` do jotaCaixa) -- transações extraídas ainda sem lançamento, de qualquer importação/conta da empresa. */
@Injectable()
export class ListarPendentesUseCase {
  constructor(@Inject(CONCILIACAO_REPOSITORIO) private readonly repositorio: ConciliacaoRepositorioPort) {}

  async executar(empresaId: string, contaContabilId?: string): Promise<TransacaoConciliacao[]> {
    return this.repositorio.listarPorStatus(empresaId, { contaContabilId, status: 'pendente' });
  }
}
