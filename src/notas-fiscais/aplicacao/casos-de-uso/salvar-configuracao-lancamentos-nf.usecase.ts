import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { DadosSalvarConfiguracaoLancamentosNf, NOTAS_FISCAIS_REPOSITORIO, NotasFiscaisRepositorioPort } from '../portas/notas-fiscais-repositorio.port';

/** Contas escolhidas pelo contador pra aprovação automática de nota fiscal (entrada: Débito despesa/Crédito passivo; saída: Débito ativo/Crédito receita) -- mesma validação de CriarContaPagarUseCase/CriarContaReceberUseCase. */
@Injectable()
export class SalvarConfiguracaoLancamentosNfUseCase {
  constructor(
    @Inject(NOTAS_FISCAIS_REPOSITORIO) private readonly repositorio: NotasFiscaisRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosSalvarConfiguracaoLancamentosNf): Promise<void> {
    await this.validarConta(dados.empresaId, dados.contaPatrimonialEntradaId, ['passivo']);
    // Entrada aceita despesa OU custo -- compra de mercadoria/matéria-prima gera CMV (custo),
    // não despesa administrativa (mesma flexibilização de CriarContaPagarUseCase).
    await this.validarConta(dados.empresaId, dados.contaResultadoEntradaId, ['despesa', 'custo']);
    await this.validarConta(dados.empresaId, dados.contaPatrimonialSaidaId, ['ativo']);
    await this.validarConta(dados.empresaId, dados.contaResultadoSaidaId, ['receita']);
    if (dados.contaRecebimentoVistaId) {
      await this.validarContaCaixaBanco(dados.empresaId, dados.contaRecebimentoVistaId);
    }

    await this.repositorio.salvarConfiguracaoLancamentos(dados);

    await this.auditoria.registrar({
      usuarioId: dados.atualizadoPor,
      empresaId: dados.empresaId,
      acao: 'SALVAR_CONFIGURACAO_LANCAMENTOS_NOTAS_FISCAIS',
      recurso: `configuracoes_lancamentos_notas_fiscais:${dados.empresaId}`,
      dadosNovos: dados,
    });
  }

  private async validarConta(empresaId: string, contaId: string, gruposEsperados: ('passivo' | 'despesa' | 'custo' | 'ativo' | 'receita')[]): Promise<void> {
    const conta = await this.planoContas.buscarPorId(contaId);
    if (!conta || conta.empresaId !== empresaId) {
      throw new NotFoundException('Conta contábil não encontrada');
    }
    if (conta.sintetica) {
      throw new BadRequestException('Conta sintética não recebe lançamento direto');
    }
    if (!gruposEsperados.includes(conta.grupo as 'passivo' | 'despesa' | 'custo' | 'ativo' | 'receita')) {
      throw new BadRequestException(`Esperava uma conta do grupo "${gruposEsperados.join('" ou "')}", recebeu "${conta.grupo}"`);
    }
  }

  private async validarContaCaixaBanco(empresaId: string, contaId: string): Promise<void> {
    const conta = await this.planoContas.buscarPorId(contaId);
    if (!conta || conta.empresaId !== empresaId) {
      throw new NotFoundException('Conta contábil não encontrada');
    }
    if (conta.sintetica) {
      throw new BadRequestException('Conta sintética não recebe lançamento direto');
    }
    if (!conta.contaCaixaBanco) {
      throw new BadRequestException('A conta de recebimento à vista precisa estar marcada como Caixa/Banco no plano de contas');
    }
  }
}
