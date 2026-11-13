import { Inject, Injectable } from '@nestjs/common';
import { QUADROS_TAREFAS_REPOSITORIO, QuadrosTarefasRepositorioPort } from '../portas/quadros-tarefas-repositorio.port';

@Injectable()
export class ReordenarColunasUseCase {
  constructor(
    @Inject(QUADROS_TAREFAS_REPOSITORIO) private readonly repositorio: QuadrosTarefasRepositorioPort,
  ) {}

  /** `colunaIds` já vem na ordem nova desejada -- a posição no array É o `ordem`. */
  async executar(colunaIds: string[]): Promise<void> {
    await this.repositorio.reordenarColunas(colunaIds.map((id, ordem) => ({ id, ordem })));
  }
}
