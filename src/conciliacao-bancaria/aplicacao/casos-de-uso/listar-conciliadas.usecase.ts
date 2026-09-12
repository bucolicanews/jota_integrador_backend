import { Inject, Injectable } from '@nestjs/common';
import { CONCILIACAO_REPOSITORIO, ConciliacaoRepositorioPort, TransacaoConciliacao } from '../portas/conciliacao-repositorio.port';

/** Ledger/auditoria (equivalente a `Extratos.tsx` do jotaCaixa) -- tudo que já virou lançamento via conciliação. */
@Injectable()
export class ListarConciliadasUseCase {
  constructor(@Inject(CONCILIACAO_REPOSITORIO) private readonly repositorio: ConciliacaoRepositorioPort) {}

  async executar(empresaId: string, contaContabilId?: string): Promise<TransacaoConciliacao[]> {
    return this.repositorio.listarPorStatus(empresaId, { contaContabilId, status: 'conciliada' });
  }
}
