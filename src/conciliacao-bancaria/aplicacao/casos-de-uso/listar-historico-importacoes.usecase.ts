import { Inject, Injectable } from '@nestjs/common';
import { CONCILIACAO_REPOSITORIO, ConciliacaoRepositorioPort, ImportacaoConciliacao } from '../portas/conciliacao-repositorio.port';

/** Aba Histórico -- lista de lotes de importação, com contagens (pendente/conciliada/duplicada/ignorada). */
@Injectable()
export class ListarHistoricoImportacoesUseCase {
  constructor(@Inject(CONCILIACAO_REPOSITORIO) private readonly repositorio: ConciliacaoRepositorioPort) {}

  async executar(empresaId: string, contaContabilId?: string): Promise<ImportacaoConciliacao[]> {
    return this.repositorio.listarImportacoes(empresaId, contaContabilId);
  }
}
