import { Inject, Injectable } from '@nestjs/common';
import { COLUNAS_PADRAO } from '../../dominio/quadro-tarefas';
import { QUADROS_TAREFAS_REPOSITORIO, QuadroComColunas, QuadrosTarefasRepositorioPort } from '../portas/quadros-tarefas-repositorio.port';

@Injectable()
export class CriarQuadroUseCase {
  constructor(
    @Inject(QUADROS_TAREFAS_REPOSITORIO) private readonly repositorio: QuadrosTarefasRepositorioPort,
  ) {}

  async executar(empresaId: string, nome: string): Promise<QuadroComColunas> {
    const quadro = await this.repositorio.criar(empresaId, nome);
    for (let ordem = 0; ordem < COLUNAS_PADRAO.length; ordem++) {
      await this.repositorio.criarColuna({ quadroId: quadro.id, nome: COLUNAS_PADRAO[ordem].nome, ordem, ehFinal: COLUNAS_PADRAO[ordem].ehFinal });
    }
    return (await this.repositorio.obterPorId(quadro.id))!;
  }
}
