import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort, DadosConfiguracaoContratos } from '../portas/contratos-repositorio.port';

/** Mesma validação de grupo contábil usada em CriarContaReceberUseCase -- falha aqui, na hora de configurar, em vez de só na hora de gerar o primeiro contrato com valor. */
@Injectable()
export class SalvarConfiguracaoContratosUseCase {
  constructor(
    @Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
  ) {}

  async executar(empresaId: string, dados: DadosConfiguracaoContratos) {
    if (dados.contaPatrimonialReceberId) await this.validarConta(empresaId, dados.contaPatrimonialReceberId, 'ativo');
    if (dados.contaResultadoReceitaId) await this.validarConta(empresaId, dados.contaResultadoReceitaId, 'receita');

    return this.repositorio.salvarConfiguracao(empresaId, dados);
  }

  private async validarConta(empresaId: string, contaId: string, grupoEsperado: 'ativo' | 'receita'): Promise<void> {
    const conta = await this.planoContas.buscarPorId(contaId);
    if (!conta || conta.empresaId !== empresaId) {
      throw new NotFoundException('Conta contábil não encontrada');
    }
    if (conta.sintetica) {
      throw new BadRequestException('Conta sintética não recebe lançamento direto');
    }
    if (conta.grupo !== grupoEsperado) {
      throw new BadRequestException(`Esperava uma conta do grupo "${grupoEsperado}", recebeu "${conta.grupo}"`);
    }
  }
}
