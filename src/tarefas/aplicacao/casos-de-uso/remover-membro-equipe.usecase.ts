import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TAREFAS_REPOSITORIO, TarefasRepositorioPort } from '../portas/tarefas-repositorio.port';

@Injectable()
export class RemoverMembroEquipeUseCase {
  constructor(
    @Inject(TAREFAS_REPOSITORIO) private readonly repositorio: TarefasRepositorioPort,
  ) {}

  async executar(tarefaId: string, empresaId: string, usuarioId: string): Promise<void> {
    const tarefa = await this.repositorio.obterPorId(tarefaId);
    if (!tarefa || tarefa.empresaId !== empresaId) {
      throw new NotFoundException('Tarefa não encontrada');
    }
    await this.repositorio.removerMembroEquipe(tarefaId, usuarioId);
  }
}
