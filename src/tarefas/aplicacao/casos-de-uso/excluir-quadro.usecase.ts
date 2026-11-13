import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { QUADROS_TAREFAS_REPOSITORIO, QuadrosTarefasRepositorioPort } from '../portas/quadros-tarefas-repositorio.port';
import { TAREFAS_REPOSITORIO, TarefasRepositorioPort } from '../portas/tarefas-repositorio.port';

@Injectable()
export class ExcluirQuadroUseCase {
  constructor(
    @Inject(QUADROS_TAREFAS_REPOSITORIO) private readonly quadrosRepositorio: QuadrosTarefasRepositorioPort,
    @Inject(TAREFAS_REPOSITORIO) private readonly tarefasRepositorio: TarefasRepositorioPort,
  ) {}

  async executar(id: string): Promise<void> {
    const emUso = await this.tarefasRepositorio.contarPorQuadro(id);
    if (emUso > 0) {
      throw new ConflictException(`Quadro tem ${emUso} tarefa(s) dentro -- mova pra outro quadro ou exclua antes.`);
    }
    await this.quadrosRepositorio.excluir(id);
  }
}
