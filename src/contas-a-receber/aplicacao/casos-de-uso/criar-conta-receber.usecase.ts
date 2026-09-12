import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { CLIENTES_REPOSITORIO, ClientesRepositorioPort } from '../../../clientes/aplicacao/portas/clientes-repositorio.port';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../../../lancamentos-contabeis/aplicacao/portas/lancamentos-repositorio.port';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { CONTAS_RECEBER_REPOSITORIO, ContasReceberRepositorioPort, DadosNovaContaReceber } from '../portas/contas-receber-repositorio.port';

/** Regime de competência: criar a conta já lança D Ativo(a receber) / C Receita, valor_total -- o recebimento em si acontece depois, em RegistrarRecebimentoUseCase. */
@Injectable()
export class CriarContaReceberUseCase {
  constructor(
    @Inject(CONTAS_RECEBER_REPOSITORIO) private readonly repositorio: ContasReceberRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly lancamentos: LancamentosRepositorioPort,
    @Inject(CLIENTES_REPOSITORIO) private readonly clientes: ClientesRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosNovaContaReceber): Promise<string> {
    await this.validarConta(dados.empresaId, dados.contaPatrimonialId, 'ativo');
    await this.validarConta(dados.empresaId, dados.contaResultadoId, 'receita');

    if (dados.clienteId) {
      const cliente = await this.clientes.obterPorId(dados.clienteId);
      if (!cliente || cliente.empresaId !== dados.empresaId) {
        throw new NotFoundException('Cliente não encontrado');
      }
    }

    if (dados.valor <= 0) throw new BadRequestException('Valor precisa ser maior que zero');

    const id = await this.repositorio.criarComParcelas(dados);

    const conta = await this.repositorio.obterPorId(id);
    if (conta) {
      await this.lancamentos.criar({
        empresaId: dados.empresaId,
        dataCompetencia: dados.dataEmissao,
        historico: `Competência: ${dados.descricao} (${dados.clienteNome})`,
        documentoReferencia: id,
        origem: 'contas_a_receber',
        partidas: [
          { contaId: dados.contaPatrimonialId, tipo: 'debito', valor: conta.valorTotal },
          { contaId: dados.contaResultadoId, tipo: 'credito', valor: conta.valorTotal },
        ],
        criadoPor: dados.criadoPor,
      });
    }

    await this.auditoria.registrar({
      usuarioId: dados.criadoPor,
      empresaId: dados.empresaId,
      acao: 'CRIAR_CONTA_RECEBER',
      recurso: `contas_receber:${id}`,
      dadosNovos: dados,
    });

    return id;
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
