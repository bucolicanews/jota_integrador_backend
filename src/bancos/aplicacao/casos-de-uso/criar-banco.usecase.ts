import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { BANCOS_REPOSITORIO, Banco, BancosRepositorioPort, DadosBanco } from '../portas/bancos-repositorio.port';

export interface DadosCriarBanco extends DadosBanco {
  usuarioId: string;
}

@Injectable()
export class CriarBancoUseCase {
  constructor(
    @Inject(BANCOS_REPOSITORIO) private readonly repositorio: BancosRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosCriarBanco): Promise<Banco> {
    await this.validarConta(dados.empresaId, dados.contaContabilId);
    await this.validarUnicidade(dados.empresaId, dados.contaContabilId);

    const banco = await this.repositorio.criar(dados);

    await this.auditoria.registrar({
      usuarioId: dados.usuarioId,
      empresaId: dados.empresaId,
      acao: 'CRIAR_BANCO',
      recurso: `bancos:${banco.id}`,
      dadosNovos: { nome: dados.nome, contaContabilId: dados.contaContabilId },
    });

    return banco;
  }

  private async validarConta(empresaId: string, contaContabilId: string): Promise<void> {
    const conta = await this.planoContas.buscarPorId(contaContabilId);
    if (!conta || conta.empresaId !== empresaId) {
      throw new NotFoundException('Conta contábil não encontrada');
    }
    if (conta.sintetica) {
      throw new BadRequestException('Conta sintética não pode ser vinculada a um banco -- selecione uma conta analítica');
    }
    if (!conta.contaCaixaBanco) {
      throw new BadRequestException('A conta selecionada não está marcada como "Caixa/Banco" no Plano de Contas');
    }
  }

  /** Checagem explícita antes do insert -- sem isso, a constraint única do banco (idx_bancos_empresa_conta) vaza um erro 500 genérico do Postgres em vez de uma mensagem clara. */
  private async validarUnicidade(empresaId: string, contaContabilId: string): Promise<void> {
    const bancos = await this.repositorio.listarPorEmpresa(empresaId);
    if (bancos.some((b) => b.contaContabilId === contaContabilId)) {
      throw new BadRequestException('Já existe um banco cadastrado para esta conta contábil');
    }
  }
}
