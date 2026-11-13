import { Inject, Injectable } from '@nestjs/common';
import { EventoFeedTarefas, TAREFAS_REPOSITORIO, TarefasRepositorioPort } from '../portas/tarefas-repositorio.port';

/** Timeline única de UMA empresa: comentário + movimentação de coluna + anexo + atribuição de TODAS as tarefas, mais recente primeiro. */
@Injectable()
export class ListarFeedTarefasUseCase {
  constructor(
    @Inject(TAREFAS_REPOSITORIO) private readonly repositorio: TarefasRepositorioPort,
  ) {}

  async executar(empresaId: string): Promise<EventoFeedTarefas[]> {
    const [comentarios, movimentos, anexos, atribuicoes] = await Promise.all([
      this.repositorio.listarComentariosPorEmpresa(empresaId),
      this.repositorio.listarHistoricoPorEmpresa(empresaId),
      this.repositorio.listarAnexosPorEmpresa(empresaId),
      this.repositorio.listarAtribuicoesPorEmpresa(empresaId),
    ]);

    const eventos: EventoFeedTarefas[] = [
      ...comentarios.map((comentario) => ({
        tipo: 'comentario' as const,
        tarefaId: comentario.tarefaId,
        criadoEm: comentario.criadoEm,
        comentario,
      })),
      ...movimentos.map((movimento) => ({
        tipo: 'movimentacao' as const,
        tarefaId: movimento.tarefaId,
        criadoEm: movimento.criadoEm,
        movimento,
      })),
      ...anexos.map((anexo) => ({
        tipo: 'anexo' as const,
        tarefaId: anexo.tarefaId,
        criadoEm: anexo.criadoEm,
        anexo,
      })),
      ...atribuicoes.map((atribuicao) => ({
        tipo: 'atribuicao' as const,
        tarefaId: atribuicao.tarefaId,
        criadoEm: atribuicao.criadoEm,
        atribuicao,
      })),
    ];

    return eventos.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
  }
}
