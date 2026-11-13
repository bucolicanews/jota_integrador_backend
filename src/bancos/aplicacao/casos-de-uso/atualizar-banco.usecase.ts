import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { BANCOS_REPOSITORIO, BancosRepositorioPort } from '../portas/bancos-repositorio.port';

export interface DadosAtualizarBanco {
  nome?: string;
  contaContabilId?: string;
  tipo?: 'banco' | 'caixa' | 'outra';
}

@Injectable()
export class AtualizarBancoUseCase {
  constructor(
    @Inject(BANCOS_REPOSITORIO) private readonly repositorio: BancosRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, dados: DadosAtualizarBanco, usuarioId: string): Promise<void> {
    const banco = await this.repositorio.obterPorId(id);
    if (!banco || banco.empresaId !== empresaId) {
      throw new NotFoundException('Banco não encontrado');
    }

    if (dados.contaContabilId || dados.tipo) {
      const contaContabilId = dados.contaContabilId ?? banco.contaContabilId;
      const tipo = dados.tipo ?? banco.tipo;
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
      // Mesma checagem que o frontend já aplica no select (nunca confiar só na UI).
      if (conta.tipoCaixaBanco !== tipo) {
        throw new BadRequestException(`A conta selecionada está marcada como "${conta.tipoCaixaBanco ?? 'sem subtipo definido'}" no Plano de Contas, não "${tipo}"`);
      }
    }

    if (dados.contaContabilId) {
      if (dados.contaContabilId !== banco.contaContabilId) {
        const bancos = await this.repositorio.listarPorEmpresa(empresaId);
        if (bancos.some((b) => b.id !== id && b.contaContabilId === dados.contaContabilId)) {
          throw new BadRequestException('Já existe um banco cadastrado para esta conta contábil');
        }
      }
    }

    await this.repositorio.atualizar(id, dados);

    await this.auditoria.registrar({
      usuarioId,
      empresaId,
      acao: 'ATUALIZAR_BANCO',
      recurso: `bancos:${id}`,
      dadosNovos: dados,
    });
  }
}
