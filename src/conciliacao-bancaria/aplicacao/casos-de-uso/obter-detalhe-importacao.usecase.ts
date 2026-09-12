import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONCILIACAO_REPOSITORIO, ConciliacaoRepositorioPort, ImportacaoConciliacao, TransacaoConciliacao } from '../portas/conciliacao-repositorio.port';

export interface DetalheImportacao {
  importacao: ImportacaoConciliacao;
  transacoes: TransacaoConciliacao[];
}

/** Equivalente a `HistoricoConciliacaoDialog.tsx` -- detalhe de 1 lote de importação passado. */
@Injectable()
export class ObterDetalheImportacaoUseCase {
  constructor(@Inject(CONCILIACAO_REPOSITORIO) private readonly repositorio: ConciliacaoRepositorioPort) {}

  async executar(importacaoId: string, empresaId: string): Promise<DetalheImportacao> {
    const importacao = await this.repositorio.obterImportacao(importacaoId);
    if (!importacao || importacao.empresaId !== empresaId) {
      throw new NotFoundException('Importação não encontrada');
    }
    const transacoes = await this.repositorio.listarTransacoesDaImportacao(importacaoId);
    return { importacao, transacoes };
  }
}
