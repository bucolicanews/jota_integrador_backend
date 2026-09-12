import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DadosHistorico, HISTORICOS_REPOSITORIO, HistoricosRepositorioPort } from '../portas/historicos-repositorio.port';

@Injectable()
export class AtualizarHistoricoUseCase {
  constructor(@Inject(HISTORICOS_REPOSITORIO) private readonly repositorio: HistoricosRepositorioPort) {}

  async executar(id: string, empresaId: string, dados: Partial<DadosHistorico>): Promise<void> {
    const historico = await this.repositorio.obterPorId(id);
    if (!historico || historico.empresaId !== empresaId) {
      throw new NotFoundException('Histórico não encontrado');
    }
    await this.repositorio.atualizar(id, dados);
  }
}
