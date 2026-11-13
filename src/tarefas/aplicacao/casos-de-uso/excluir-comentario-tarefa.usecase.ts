import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TAREFAS_REPOSITORIO, TarefasRepositorioPort } from '../portas/tarefas-repositorio.port';

/** Excluir é só do próprio autor -- mesma regra de atualizar-comentario-tarefa.usecase. */
@Injectable()
export class ExcluirComentarioTarefaUseCase {
  constructor(
    @Inject(TAREFAS_REPOSITORIO) private readonly repositorio: TarefasRepositorioPort,
  ) {}

  async executar(comentarioId: string, tarefaId: string, usuarioId: string): Promise<void> {
    const comentario = await this.repositorio.obterComentarioPorId(comentarioId);
    if (!comentario || comentario.tarefaId !== tarefaId) {
      throw new NotFoundException('Comentário não encontrado');
    }
    if (comentario.autorId !== usuarioId) {
      throw new ForbiddenException('Só o autor pode excluir o próprio comentário');
    }
    await this.repositorio.excluirComentario(comentarioId);
  }
}
