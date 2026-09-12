import { Inject, Injectable } from '@nestjs/common';
import { DadosHistorico, HISTORICOS_REPOSITORIO, Historico, HistoricosRepositorioPort } from '../portas/historicos-repositorio.port';

@Injectable()
export class CriarHistoricoUseCase {
  constructor(@Inject(HISTORICOS_REPOSITORIO) private readonly repositorio: HistoricosRepositorioPort) {}

  async executar(dados: DadosHistorico): Promise<Historico> {
    return this.repositorio.criar(dados);
  }
}
