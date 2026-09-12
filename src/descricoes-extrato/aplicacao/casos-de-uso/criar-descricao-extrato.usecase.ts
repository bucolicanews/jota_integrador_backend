import { Inject, Injectable } from '@nestjs/common';
import {
  DadosDescricaoExtrato,
  DESCRICOES_EXTRATO_REPOSITORIO,
  DescricaoExtrato,
  DescricoesExtratoRepositorioPort,
} from '../portas/descricoes-extrato-repositorio.port';

@Injectable()
export class CriarDescricaoExtratoUseCase {
  constructor(@Inject(DESCRICOES_EXTRATO_REPOSITORIO) private readonly repositorio: DescricoesExtratoRepositorioPort) {}

  async executar(dados: DadosDescricaoExtrato): Promise<DescricaoExtrato> {
    return this.repositorio.criar(dados);
  }
}
