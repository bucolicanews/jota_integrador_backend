import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NOTIFICACOES_REPOSITORIO, NotificacoesRepositorioPort } from '../portas/notificacoes-repositorio.port';
import { QUADROS_TAREFAS_REPOSITORIO, QuadrosTarefasRepositorioPort } from '../portas/quadros-tarefas-repositorio.port';
import { TAREFAS_REPOSITORIO, TarefasRepositorioPort } from '../portas/tarefas-repositorio.port';

/**
 * "Bumerangue": só dispara notificação pro `criadoPor` quando a tarefa chega numa
 * coluna `ehFinal` (confirmado com o usuário -- não em toda movimentação, só na final).
 * Toda movimentação (final ou não) grava uma linha em `tarefas_historico` -- inclusive
 * quem ficou RESPONSÁVEL por essa etapa específica (`responsavelId`, pode mudar
 * movimento a movimento, nunca fixo por coluna) -- é o que deixa o criador ciente de
 * cada passo mesmo sem notificação em cada um.
 *
 * `quadroId` é derivado da coluna destino (nunca aceito cru do body) -- tarefa pode
 * migrar de quadro (pedido 2026-11-12), mas sempre pra onde a coluna de fato pertence,
 * Zero Trust igual todo resto do backend.
 */
@Injectable()
export class MoverTarefaUseCase {
  constructor(
    @Inject(TAREFAS_REPOSITORIO) private readonly tarefasRepositorio: TarefasRepositorioPort,
    @Inject(QUADROS_TAREFAS_REPOSITORIO) private readonly quadrosRepositorio: QuadrosTarefasRepositorioPort,
    @Inject(NOTIFICACOES_REPOSITORIO) private readonly notificacoesRepositorio: NotificacoesRepositorioPort,
  ) {}

  async executar(
    tarefaId: string,
    empresaId: string,
    novaColunaId: string,
    novaOrdem: number,
    movidoPor: string,
    responsavelId: string | null,
  ): Promise<void> {
    const tarefa = await this.tarefasRepositorio.obterPorId(tarefaId);
    if (!tarefa || tarefa.empresaId !== empresaId) {
      throw new NotFoundException('Tarefa não encontrada');
    }

    const novaColuna = await this.quadrosRepositorio.obterColunaPorId(novaColunaId);
    if (!novaColuna) {
      throw new NotFoundException('Coluna não encontrada');
    }
    const novoQuadro = await this.quadrosRepositorio.obterPorId(novaColuna.quadroId);
    if (!novoQuadro || novoQuadro.empresaId !== empresaId) {
      throw new NotFoundException('Quadro de destino não pertence a esta empresa');
    }

    const colunaOrigemId = tarefa.colunaId;
    await this.tarefasRepositorio.mover(tarefaId, novaColuna.quadroId, novaColunaId, novaOrdem);

    // Reordenar dentro da MESMA coluna não é "movimentação" de fato -- sem histórico/notificação.
    if (colunaOrigemId === novaColunaId) {
      return;
    }

    await this.tarefasRepositorio.registrarMovimento({
      tarefaId,
      colunaOrigemId,
      colunaDestinoId: novaColunaId,
      movidoPor,
      responsavelId,
    });

    if (novaColuna.ehFinal && tarefa.criadoPor !== movidoPor) {
      await this.notificacoesRepositorio.criar({
        usuarioId: tarefa.criadoPor,
        tarefaId: tarefa.id,
        mensagem: `Sua tarefa "${tarefa.titulo}" chegou em "${novaColuna.nome}".`,
      });
    }
  }
}
