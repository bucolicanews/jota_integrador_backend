import { Inject, Injectable } from '@nestjs/common';
import { DESCRICOES_EXTRATO_REPOSITORIO, DescricaoExtrato, DescricoesExtratoRepositorioPort } from '../portas/descricoes-extrato-repositorio.port';

@Injectable()
export class ListarDescricoesExtratoUseCase {
  constructor(@Inject(DESCRICOES_EXTRATO_REPOSITORIO) private readonly repositorio: DescricoesExtratoRepositorioPort) {}

  async executar(empresaId: string): Promise<DescricaoExtrato[]> {
    return this.repositorio.listarPorEmpresa(empresaId);
  }
}
