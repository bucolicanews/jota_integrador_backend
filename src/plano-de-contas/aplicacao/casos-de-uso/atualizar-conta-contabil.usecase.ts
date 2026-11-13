import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../../../lancamentos-contabeis/aplicacao/portas/lancamentos-repositorio.port';
import {
  DadosAtualizacaoContaContabil,
  PLANO_CONTAS_REPOSITORIO,
  PlanoContasRepositorioPort,
} from '../portas/plano-contas-repositorio.port';

@Injectable()
export class AtualizarContaContabilUseCase {
  constructor(
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly repositorio: PlanoContasRepositorioPort,
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly lancamentosRepositorio: LancamentosRepositorioPort,
  ) {}

  async executar(id: string, dados: DadosAtualizacaoContaContabil): Promise<void> {
    if (dados.sintetica !== undefined) {
      await this.validarMudancaDeTipo(id, dados.sintetica);
    }
    await this.repositorio.atualizar(id, dados);
  }

  /**
   * Converter sintética↔analítica depois de criada só é seguro quando não deixa dado
   * órfão: sintética→analítica exige zero contas filhas (senão elas ficam com um pai que
   * não agrupa mais nada -- CriarContaContabilUseCase já exige pai sintético, então a
   * inversa também precisa valer); analítica→sintética exige zero lançamento já
   * registrado nela (senão um lançamento real passa a apontar pra uma conta que só
   * agrupa, quebrando relatório).
   */
  private async validarMudancaDeTipo(id: string, novaSintetica: boolean): Promise<void> {
    const contaAtual = await this.repositorio.buscarPorId(id);
    if (!contaAtual) {
      throw new NotFoundException('Conta contábil não encontrada');
    }
    if (contaAtual.sintetica === novaSintetica) return;

    if (contaAtual.sintetica && !novaSintetica) {
      const todas = await this.repositorio.listarPorEmpresa(contaAtual.empresaId);
      if (todas.some((c) => c.contaPaiId === id)) {
        throw new BadRequestException('Esta conta tem contas filhas -- não pode virar analítica enquanto elas existirem');
      }
    } else {
      const lancamentos = await this.lancamentosRepositorio.listarPorEmpresa(contaAtual.empresaId, { contaId: id });
      if (lancamentos.length > 0) {
        throw new BadRequestException('Esta conta já tem lançamento registrado -- não pode virar sintética');
      }
    }
  }
}
