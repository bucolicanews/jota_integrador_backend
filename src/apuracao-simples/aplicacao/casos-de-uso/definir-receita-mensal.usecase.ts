import { Inject, Injectable } from '@nestjs/common';
import { ReceitaMensal } from '../../dominio/receita-mensal';
import { DadosDefinirReceitaMensal, RECEITAS_MENSAIS_REPOSITORIO, ReceitasMensaisRepositorioPort } from '../portas/receitas-mensais-repositorio.port';

@Injectable()
export class DefinirReceitaMensalUseCase {
  constructor(@Inject(RECEITAS_MENSAIS_REPOSITORIO) private readonly repositorio: ReceitasMensaisRepositorioPort) {}

  async executar(dados: DadosDefinirReceitaMensal): Promise<ReceitaMensal> {
    return this.repositorio.definir(dados);
  }
}
