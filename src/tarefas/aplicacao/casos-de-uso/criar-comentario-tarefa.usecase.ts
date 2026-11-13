import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ComentarioTarefa, TAREFAS_REPOSITORIO, TarefasRepositorioPort } from '../portas/tarefas-repositorio.port';

/**
 * Só quem está ATRIBUÍDO à tarefa no momento pode comentar (pedido explícito do
 * usuário, 2026-11-13: "quando a tarefa está com ele") -- nem o criador, nem dono do
 * quadro, nem qualquer outro colega. Reatribuir a tarefa muda quem pode comentar a
 * partir daí, nunca retroativo aos comentários já existentes.
 */
@Injectable()
export class CriarComentarioTarefaUseCase {
  constructor(
    @Inject(TAREFAS_REPOSITORIO) private readonly repositorio: TarefasRepositorioPort,
  ) {}

  async executar(tarefaId: string, empresaId: string, autorId: string, corpo: string): Promise<ComentarioTarefa> {
    const tarefa = await this.repositorio.obterPorId(tarefaId);
    if (!tarefa || tarefa.empresaId !== empresaId) {
      throw new NotFoundException('Tarefa não encontrada');
    }
    if (tarefa.atribuidoA !== autorId) {
      throw new ForbiddenException('Só quem está atribuído à tarefa pode comentar');
    }
    return this.repositorio.criarComentario(tarefaId, autorId, corpo);
  }
}
