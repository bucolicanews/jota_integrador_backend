import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { validarPermaneceColunaFinal } from '../../dominio/quadro-tarefas';
import {
  DadosAtualizarColuna,
  QUADROS_TAREFAS_REPOSITORIO,
  QuadrosTarefasRepositorioPort,
} from '../portas/quadros-tarefas-repositorio.port';

@Injectable()
export class AtualizarColunaUseCase {
  constructor(
    @Inject(QUADROS_TAREFAS_REPOSITORIO) private readonly repositorio: QuadrosTarefasRepositorioPort,
  ) {}

  async executar(colunaId: string, quadroId: string, dados: DadosAtualizarColuna): Promise<void> {
    if (dados.ehFinal === false) {
      const colunas = await this.repositorio.listarColunas(quadroId);
      if (!colunas.some((coluna) => coluna.id === colunaId)) {
        throw new NotFoundException('Coluna não encontrada neste quadro');
      }
      try {
        validarPermaneceColunaFinal(colunas, colunaId);
      } catch (erro) {
        throw new BadRequestException((erro as Error).message);
      }
    }

    await this.repositorio.atualizarColuna(colunaId, dados);
  }
}
