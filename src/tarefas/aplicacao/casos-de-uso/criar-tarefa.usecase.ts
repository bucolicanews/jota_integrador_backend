import { Inject, Injectable } from '@nestjs/common';
import { DadosNovaTarefa, TAREFAS_REPOSITORIO, Tarefa, TarefasRepositorioPort } from '../portas/tarefas-repositorio.port';

@Injectable()
export class CriarTarefaUseCase {
  constructor(
    @Inject(TAREFAS_REPOSITORIO) private readonly repositorio: TarefasRepositorioPort,
  ) {}

  async executar(dados: Omit<DadosNovaTarefa, 'ordem'>): Promise<Tarefa> {
    const existentes = await this.repositorio.listarPorEmpresa(dados.empresaId);
    const ordem = existentes.filter((tarefa) => tarefa.colunaId === dados.colunaId).length;
    const tarefa = await this.repositorio.criar({ ...dados, ordem });

    // Já nasce atribuída a alguém -- conta como o primeiro evento de atribuição do
    // pipeline ("Fulano atribuiu a tarefa a Ciclano"), não só as trocas posteriores.
    if (dados.atribuidoA) {
      await this.repositorio.registrarAtribuicao({
        tarefaId: tarefa.id,
        deUsuarioId: null,
        paraUsuarioId: dados.atribuidoA,
        atribuidoPor: dados.criadoPor,
      });
    }

    return tarefa;
  }
}
