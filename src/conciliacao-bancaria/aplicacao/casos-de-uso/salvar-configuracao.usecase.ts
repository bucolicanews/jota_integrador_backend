import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import {
  CONCILIACAO_REPOSITORIO,
  ConciliacaoRepositorioPort,
  ConfiguracaoConciliacao,
  DadosConfiguracao,
} from '../portas/conciliacao-repositorio.port';

@Injectable()
export class SalvarConfiguracaoUseCase {
  constructor(
    @Inject(CONCILIACAO_REPOSITORIO) private readonly repositorio: ConciliacaoRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
  ) {}

  async criar(dados: DadosConfiguracao): Promise<ConfiguracaoConciliacao> {
    await this.validarContaCaixaBanco(dados.empresaId, dados.contaContabilId);
    return this.repositorio.criarConfiguracao(dados);
  }

  async atualizar(id: string, empresaId: string, dados: Partial<DadosConfiguracao>): Promise<void> {
    const existente = await this.repositorio.obterConfiguracao(id);
    if (!existente || existente.empresaId !== empresaId) {
      throw new NotFoundException('Configuração de conciliação não encontrada');
    }
    if (dados.contaContabilId) {
      await this.validarContaCaixaBanco(empresaId, dados.contaContabilId);
    }
    await this.repositorio.atualizarConfiguracao(id, dados);
  }

  private async validarContaCaixaBanco(empresaId: string, contaContabilId: string): Promise<void> {
    const conta = await this.planoContas.buscarPorId(contaContabilId);
    if (!conta || conta.empresaId !== empresaId) {
      throw new NotFoundException('Conta contábil não encontrada');
    }
    if (!conta.contaCaixaBanco) {
      throw new BadRequestException('A conta selecionada não está marcada como Caixa/Banco no plano de contas');
    }
  }
}
