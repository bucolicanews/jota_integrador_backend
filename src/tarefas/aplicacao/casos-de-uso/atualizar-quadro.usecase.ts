import { Inject, Injectable } from '@nestjs/common';
import { QUADROS_TAREFAS_REPOSITORIO, QuadrosTarefasRepositorioPort } from '../portas/quadros-tarefas-repositorio.port';

@Injectable()
export class AtualizarQuadroUseCase {
  constructor(
    @Inject(QUADROS_TAREFAS_REPOSITORIO) private readonly repositorio: QuadrosTarefasRepositorioPort,
  ) {}

  async executar(id: string, nome: string): Promise<void> {
    await this.repositorio.atualizar(id, nome);
  }
}
