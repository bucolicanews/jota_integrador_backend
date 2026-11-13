import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TAREFAS_REPOSITORIO, TarefasRepositorioPort } from '../portas/tarefas-repositorio.port';

/** Editar é só do próprio autor -- não acompanha o atribuido_a atual da tarefa. */
@Injectable()
export class AtualizarComentarioTarefaUseCase {
  constructor(
    @Inject(TAREFAS_REPOSITORIO) private readonly repositorio: TarefasRepositorioPort,
  ) {}

  async executar(comentarioId: string, tarefaId: string, usuarioId: string, corpo: string): Promise<void> {
    const comentario = await this.repositorio.obterComentarioPorId(comentarioId);
    if (!comentario || comentario.tarefaId !== tarefaId) {
      throw new NotFoundException('Comentário não encontrado');
    }
    if (comentario.autorId !== usuarioId) {
      throw new ForbiddenException('Só o autor pode editar o próprio comentário');
    }
    await this.repositorio.atualizarComentario(comentarioId, corpo);
  }
}
