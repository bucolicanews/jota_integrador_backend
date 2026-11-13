import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import {
  DadosAtualizacaoLancamento,
  LANCAMENTOS_REPOSITORIO,
  LancamentosRepositorioPort,
} from '../portas/lancamentos-repositorio.port';

@Injectable()
export class AtualizarLancamentoUseCase {
  constructor(
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly repositorio: LancamentosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, dados: DadosAtualizacaoLancamento, editadoPorId: string): Promise<void> {
    const lancamento = await this.repositorio.obterPorId(id);
    if (!lancamento || lancamento.empresaId !== empresaId) {
      throw new NotFoundException('Lançamento não encontrado');
    }
    if (lancamento.estornado) {
      throw new BadRequestException('Lançamento já foi estornado -- não é possível editar, lance um ajuste novo');
    }
    if (lancamento.origem === 'estorno') {
      throw new BadRequestException('Lançamento de estorno não pode ser editado -- ele é o par imutável de outro lançamento');
    }

    await this.repositorio.atualizar(id, dados, editadoPorId);

    await this.auditoria.registrar({
      usuarioId: editadoPorId,
      empresaId,
      acao: 'ATUALIZAR_LANCAMENTO_CONTABIL',
      recurso: `lancamentos_contabeis:${id}`,
      dadosAntigos: { dataCompetencia: lancamento.dataCompetencia, historico: lancamento.historico, partidas: lancamento.partidas },
      dadosNovos: dados,
    });
  }
}
