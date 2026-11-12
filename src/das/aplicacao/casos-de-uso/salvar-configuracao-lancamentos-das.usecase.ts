import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { DAS_REPOSITORIO, DasRepositorioPort } from '../portas/das-repositorio.port';

export interface DadosSalvarConfiguracaoLancamentosDasEntrada {
  empresaId: string;
  contaDebitoId: string;
  contaCreditoId: string;
  atualizadoPor: string;
}

/** Contas escolhidas pelo contador pra provisão automática do DAS (Débito despesa / Crédito passivo) -- mesma validação de CriarContaPagarUseCase. */
@Injectable()
export class SalvarConfiguracaoLancamentosDasUseCase {
  constructor(
    @Inject(DAS_REPOSITORIO) private readonly dasRepositorio: DasRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosSalvarConfiguracaoLancamentosDasEntrada): Promise<void> {
    await this.validarConta(dados.empresaId, dados.contaDebitoId, 'despesa');
    await this.validarConta(dados.empresaId, dados.contaCreditoId, 'passivo');

    await this.dasRepositorio.salvarConfiguracaoLancamentos(dados);

    await this.auditoria.registrar({
      usuarioId: dados.atualizadoPor,
      empresaId: dados.empresaId,
      acao: 'SALVAR_CONFIGURACAO_LANCAMENTOS_DAS',
      recurso: `das_configuracoes_lancamentos:${dados.empresaId}`,
      dadosNovos: { contaDebitoId: dados.contaDebitoId, contaCreditoId: dados.contaCreditoId },
    });
  }

  private async validarConta(empresaId: string, contaId: string, grupoEsperado: 'passivo' | 'despesa'): Promise<void> {
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
