import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DadosAtualizarTarefa, TAREFAS_REPOSITORIO, TarefasRepositorioPort } from '../portas/tarefas-repositorio.port';

@Injectable()
export class AtualizarTarefaUseCase {
  constructor(
    @Inject(TAREFAS_REPOSITORIO) private readonly repositorio: TarefasRepositorioPort,
  ) {}

  /**
   * `atribuidoPor` é quem está fazendo a chamada (controller) -- só usado pra registrar
   * em tarefas_atribuicoes_historico quando `dados.atribuidoA` de fato muda o valor
   * atual (pedido 2026-11-13: pipeline tem que mostrar "Fulano atribuiu a tarefa a
   * Ciclano"). Sem mudança de valor, nenhuma linha nova -- editar outro campo sem
   * tocar em atribuidoA não deveria gerar evento de atribuição no feed.
   */
  async executar(id: string, empresaId: string, dados: DadosAtualizarTarefa, atribuidoPor: string): Promise<void> {
    const tarefa = await this.repositorio.obterPorId(id);
    if (!tarefa || tarefa.empresaId !== empresaId) {
      throw new NotFoundException('Tarefa não encontrada');
    }

    const atribuicaoMudou = dados.atribuidoA !== undefined && dados.atribuidoA !== tarefa.atribuidoA;

    await this.repositorio.atualizar(id, dados);

    if (atribuicaoMudou) {
      await this.repositorio.registrarAtribuicao({
        tarefaId: id,
        deUsuarioId: tarefa.atribuidoA,
        paraUsuarioId: dados.atribuidoA ?? null,
        atribuidoPor,
      });
    }
  }
}
