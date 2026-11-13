import { Inject, Injectable } from '@nestjs/common';
import { COLUNAS_PADRAO } from '../../dominio/quadro-tarefas';
import {
  QUADROS_TAREFAS_REPOSITORIO,
  QuadroComColunas,
  QuadrosTarefasRepositorioPort,
} from '../portas/quadros-tarefas-repositorio.port';

/** Auto-cria 1 quadro padrão ("Quadro Principal", com as 3 colunas padrão) só se a empresa ainda não tiver nenhum -- nunca fica vazio no 1º acesso, mas depois são N quadros livres. */
@Injectable()
export class ListarQuadrosUseCase {
  constructor(
    @Inject(QUADROS_TAREFAS_REPOSITORIO) private readonly repositorio: QuadrosTarefasRepositorioPort,
  ) {}

  async executar(empresaId: string): Promise<QuadroComColunas[]> {
    const existentes = await this.repositorio.listarPorEmpresa(empresaId);
    if (existentes.length > 0) {
      return existentes;
    }

    const quadro = await this.repositorio.criar(empresaId, 'Quadro Principal');
    for (let ordem = 0; ordem < COLUNAS_PADRAO.length; ordem++) {
      await this.repositorio.criarColuna({ quadroId: quadro.id, nome: COLUNAS_PADRAO[ordem].nome, ordem, ehFinal: COLUNAS_PADRAO[ordem].ehFinal });
    }

    return this.repositorio.listarPorEmpresa(empresaId);
  }
}
