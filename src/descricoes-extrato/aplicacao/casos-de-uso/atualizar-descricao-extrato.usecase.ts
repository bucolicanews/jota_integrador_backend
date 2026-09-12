import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DadosDescricaoExtrato, DESCRICOES_EXTRATO_REPOSITORIO, DescricoesExtratoRepositorioPort } from '../portas/descricoes-extrato-repositorio.port';

@Injectable()
export class AtualizarDescricaoExtratoUseCase {
  constructor(@Inject(DESCRICOES_EXTRATO_REPOSITORIO) private readonly repositorio: DescricoesExtratoRepositorioPort) {}

  async executar(id: string, empresaId: string, dados: Partial<DadosDescricaoExtrato>): Promise<void> {
    const item = await this.repositorio.obterPorId(id);
    if (!item || item.empresaId !== empresaId) {
      throw new NotFoundException('Descrição não encontrada');
    }
    await this.repositorio.atualizar(id, dados);
  }
}
