import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../../../lancamentos-contabeis/aplicacao/portas/lancamentos-repositorio.port';
import { CONTAS_RECEBER_REPOSITORIO, ContasReceberRepositorioPort } from '../portas/contas-receber-repositorio.port';

/** Recria o lançamento de competência (D patrimonial/C resultado) de uma conta a receber que ficou sem lançamento ativo -- ex: o lançamento original foi estornado por engano/ajuste e a conta continua em aberto. Nunca roda se já existe lançamento ativo (evita duplicar o reconhecimento da receita). */
@Injectable()
export class RelancarLancamentoContaReceberUseCase {
  constructor(
    @Inject(CONTAS_RECEBER_REPOSITORIO) private readonly repositorio: ContasReceberRepositorioPort,
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly lancamentos: LancamentosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(contaReceberId: string, empresaId: string, executadoPor: string): Promise<string> {
    const conta = await this.repositorio.obterPorId(contaReceberId);
    if (!conta || conta.empresaId !== empresaId) {
      throw new NotFoundException('Conta a receber não encontrada');
    }
    if (conta.cancelada) {
      throw new BadRequestException('Conta a receber cancelada não recebe lançamento novo');
    }
    if (conta.temLancamentoAtivo) {
      throw new BadRequestException('Esta conta já tem um lançamento de competência ativo');
    }

    const lancamentoId = await this.lancamentos.criar({
      empresaId,
      dataCompetencia: new Date().toISOString().slice(0, 10),
      historico: `Competência (relançado): ${conta.descricao} (${conta.clienteNome})`,
      documentoReferencia: contaReceberId,
      origem: 'contas_a_receber',
      partidas: [
        { contaId: conta.contaPatrimonialId, tipo: 'debito', valor: conta.valorTotal },
        { contaId: conta.contaResultadoId, tipo: 'credito', valor: conta.valorTotal },
      ],
      criadoPor: executadoPor,
    });

    await this.auditoria.registrar({
      usuarioId: executadoPor,
      empresaId,
      acao: 'RELANCAR_LANCAMENTO_CONTA_RECEBER',
      recurso: `contas_receber:${contaReceberId}`,
      dadosNovos: { lancamentoId },
    });

    return lancamentoId;
  }
}
