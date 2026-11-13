import { Inject, Injectable } from '@nestjs/common';
import { TAREFAS_REPOSITORIO, Tarefa, TarefasRepositorioPort } from '../portas/tarefas-repositorio.port';

@Injectable()
export class ListarTarefasUseCase {
  constructor(
    @Inject(TAREFAS_REPOSITORIO) private readonly repositorio: TarefasRepositorioPort,
  ) {}

  async executar(empresaId: string): Promise<Tarefa[]> {
    return this.repositorio.listarPorEmpresa(empresaId);
  }
}
