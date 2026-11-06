import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../portas/empresas-repositorio.port';

export interface DadosAtualizarPagbankContaEmpresa {
  pagbankAccountId?: string | null;
  bancoPagbankId?: string | null;
  contaContabilPagbankId?: string | null;
}

/**
 * contaContabilPagbankId é a alternativa pra empresa sem o módulo "bancos" liberado --
 * aponta direto pra uma conta do Plano de Contas (núcleo, sem módulo nem cadastro formal
 * de banco). Mutuamente exclusivo com bancoPagbankId: setar um sempre limpa o outro, pra
 * ProcessarWebhookPagbankParcelaUseCase nunca ter ambiguidade sobre qual usar pra fechar
 * o ciclo contábil.
 */
@Injectable()
export class AtualizarPagbankContaEmpresaUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContasRepositorio: PlanoContasRepositorioPort,
  ) {}

  async executar(empresaId: string, dados: DadosAtualizarPagbankContaEmpresa): Promise<void> {
    const campos: DadosAtualizarPagbankContaEmpresa = { ...dados };

    if (dados.contaContabilPagbankId) {
      await this.validarContaContabil(empresaId, dados.contaContabilPagbankId);
      campos.bancoPagbankId = null;
    } else if (dados.bancoPagbankId) {
      campos.contaContabilPagbankId = null;
    }

    await this.empresasRepositorio.atualizarPagbankConta(empresaId, campos);
  }

  private async validarContaContabil(empresaId: string, contaId: string): Promise<void> {
    const conta = await this.planoContasRepositorio.buscarPorId(contaId);
    if (!conta || conta.empresaId !== empresaId) {
      throw new NotFoundException('Conta contábil não encontrada');
    }
    if (conta.sintetica) {
      throw new BadRequestException('Conta sintética não pode receber o split -- selecione uma conta analítica');
    }
    if (!conta.contaCaixaBanco) {
      throw new BadRequestException('A conta selecionada não está marcada como "Caixa/Banco" no Plano de Contas');
    }
  }
}
