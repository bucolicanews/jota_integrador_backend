import { Inject, Injectable } from '@nestjs/common';
import { Coluna, QUADROS_TAREFAS_REPOSITORIO, QuadrosTarefasRepositorioPort } from '../portas/quadros-tarefas-repositorio.port';

@Injectable()
export class CriarColunaUseCase {
  constructor(
    @Inject(QUADROS_TAREFAS_REPOSITORIO) private readonly repositorio: QuadrosTarefasRepositorioPort,
  ) {}

  async executar(quadroId: string, nome: string, ehFinal: boolean): Promise<Coluna> {
    const colunas = await this.repositorio.listarColunas(quadroId);
    return this.repositorio.criarColuna({ quadroId, nome, ordem: colunas.length, ehFinal });
  }
}
