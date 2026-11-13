import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { validarPermaneceColunaFinal } from '../../dominio/quadro-tarefas';
import { QUADROS_TAREFAS_REPOSITORIO, QuadrosTarefasRepositorioPort } from '../portas/quadros-tarefas-repositorio.port';
import { TAREFAS_REPOSITORIO, TarefasRepositorioPort } from '../portas/tarefas-repositorio.port';

@Injectable()
export class ExcluirColunaUseCase {
  constructor(
    @Inject(QUADROS_TAREFAS_REPOSITORIO) private readonly quadrosRepositorio: QuadrosTarefasRepositorioPort,
    @Inject(TAREFAS_REPOSITORIO) private readonly tarefasRepositorio: TarefasRepositorioPort,
  ) {}

  async executar(colunaId: string, quadroId: string): Promise<void> {
    const emUso = await this.tarefasRepositorio.contarPorColuna(colunaId);
    if (emUso > 0) {
      throw new ConflictException(`Coluna tem ${emUso} tarefa(s) dentro -- mova ou exclua antes.`);
    }

    const colunas = await this.quadrosRepositorio.listarColunas(quadroId);
    const colunaAlvo = colunas.find((coluna) => coluna.id === colunaId);
    if (!colunaAlvo) {
      throw new NotFoundException('Coluna não encontrada neste quadro');
    }
    if (colunaAlvo.ehFinal) {
      try {
        validarPermaneceColunaFinal(colunas, colunaId);
      } catch (erro) {
        throw new BadRequestException((erro as Error).message);
      }
    }

    await this.quadrosRepositorio.excluirColuna(colunaId);
  }
}
