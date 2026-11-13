import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AnexoTarefa, TAREFAS_REPOSITORIO, TarefasRepositorioPort } from '../portas/tarefas-repositorio.port';

@Injectable()
export class ListarAnexosTarefaUseCase {
  constructor(
    @Inject(TAREFAS_REPOSITORIO) private readonly repositorio: TarefasRepositorioPort,
  ) {}

  async executar(tarefaId: string, empresaId: string): Promise<AnexoTarefa[]> {
    const tarefa = await this.repositorio.obterPorId(tarefaId);
    if (!tarefa || tarefa.empresaId !== empresaId) {
      throw new NotFoundException('Tarefa não encontrada');
    }
    return this.repositorio.listarAnexos(tarefaId);
  }
}
