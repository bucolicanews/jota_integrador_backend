import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TAREFAS_REPOSITORIO, TarefasRepositorioPort } from '../portas/tarefas-repositorio.port';

@Injectable()
export class ExcluirTarefaUseCase {
  constructor(
    @Inject(TAREFAS_REPOSITORIO) private readonly repositorio: TarefasRepositorioPort,
  ) {}

  async executar(id: string, empresaId: string): Promise<void> {
    const tarefa = await this.repositorio.obterPorId(id);
    if (!tarefa || tarefa.empresaId !== empresaId) {
      throw new NotFoundException('Tarefa não encontrada');
    }
    await this.repositorio.excluir(id);
  }
}
