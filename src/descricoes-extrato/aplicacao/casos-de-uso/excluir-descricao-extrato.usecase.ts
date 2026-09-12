import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DESCRICOES_EXTRATO_REPOSITORIO, DescricoesExtratoRepositorioPort } from '../portas/descricoes-extrato-repositorio.port';

@Injectable()
export class ExcluirDescricaoExtratoUseCase {
  constructor(@Inject(DESCRICOES_EXTRATO_REPOSITORIO) private readonly repositorio: DescricoesExtratoRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<void> {
    const item = await this.repositorio.obterPorId(id);
    if (!item || item.empresaId !== empresaId) {
      throw new NotFoundException('Descrição não encontrada');
    }
    await this.repositorio.excluir(id);
  }
}
