import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { FORNECEDORES_REPOSITORIO, FornecedoresRepositorioPort } from '../../../fornecedores/aplicacao/portas/fornecedores-repositorio.port';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../../../lancamentos-contabeis/aplicacao/portas/lancamentos-repositorio.port';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { CONTAS_PAGAR_REPOSITORIO, ContasPagarRepositorioPort, DadosNovaContaPagar } from '../portas/contas-pagar-repositorio.port';

/**
 * Regime de competência (accrual), igual ao jotaCaixa: criar a conta já lança a
 * despesa/passivo na hora (D Despesa / C Passivo, valor_total) -- não espera o
 * pagamento acontecer pra reconhecer a obrigação. A baixa (D Passivo / C Caixa/Banco)
 * acontece depois, em RegistrarPagamentoUseCase.
 */
@Injectable()
export class CriarContaPagarUseCase {
  constructor(
    @Inject(CONTAS_PAGAR_REPOSITORIO) private readonly repositorio: ContasPagarRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly lancamentos: LancamentosRepositorioPort,
    @Inject(FORNECEDORES_REPOSITORIO) private readonly fornecedores: FornecedoresRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosNovaContaPagar): Promise<string> {
    await this.validarConta(dados.empresaId, dados.contaPatrimonialId, ['passivo']);
    // Débito aceita despesa OU custo -- compra de mercadoria/matéria-prima gera CMV (custo),
    // não despesa administrativa; mantém despesa pra não quebrar os usos já existentes (DAS etc).
    await this.validarConta(dados.empresaId, dados.contaResultadoId, ['despesa', 'custo']);

    if (dados.fornecedorId) {
      const fornecedor = await this.fornecedores.obterPorId(dados.fornecedorId);
      if (!fornecedor || fornecedor.empresaId !== dados.empresaId) {
        throw new NotFoundException('Fornecedor não encontrado');
      }
    }

    if (dados.valor <= 0) throw new BadRequestException('Valor precisa ser maior que zero');

    const id = await this.repositorio.criarComParcelas(dados);

    const conta = await this.repositorio.obterPorId(id);
    if (conta) {
      await this.lancamentos.criar({
        empresaId: dados.empresaId,
        dataCompetencia: dados.dataEmissao,
        historico: `Competência: ${dados.descricao} (${dados.fornecedor})`,
        documentoReferencia: id,
        origem: 'contas_a_pagar',
        partidas: [
          { contaId: dados.contaResultadoId, tipo: 'debito', valor: conta.valorTotal },
          { contaId: dados.contaPatrimonialId, tipo: 'credito', valor: conta.valorTotal },
        ],
        criadoPor: dados.criadoPor,
      });
    }

    await this.auditoria.registrar({
      usuarioId: dados.criadoPor,
      empresaId: dados.empresaId,
      acao: 'CRIAR_CONTA_PAGAR',
      recurso: `contas_pagar:${id}`,
      dadosNovos: dados,
    });

    return id;
  }

  private async validarConta(empresaId: string, contaId: string, gruposEsperados: ('passivo' | 'despesa' | 'custo')[]): Promise<void> {
    const conta = await this.planoContas.buscarPorId(contaId);
    if (!conta || conta.empresaId !== empresaId) {
      throw new NotFoundException('Conta contábil não encontrada');
    }
    if (conta.sintetica) {
      throw new BadRequestException('Conta sintética não recebe lançamento direto');
    }
    if (!gruposEsperados.includes(conta.grupo as 'passivo' | 'despesa' | 'custo')) {
      throw new BadRequestException(`Esperava uma conta do grupo "${gruposEsperados.join('" ou "')}", recebeu "${conta.grupo}"`);
    }
  }
}
