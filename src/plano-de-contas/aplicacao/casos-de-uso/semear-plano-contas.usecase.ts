import { Inject, Injectable } from '@nestjs/common';
import { MODELOS_PLANO_CONTAS, ModeloPlanoContas } from '../../dominio/modelos-plano-contas';
import {
  PLANO_CONTAS_REPOSITORIO,
  PlanoContasRepositorioPort,
  ResultadoImportacaoPlanoContas,
} from '../portas/plano-contas-repositorio.port';

/** Usado na criação da empresa, quando o contador já escolhe um modelo padrão em vez de montar o plano do zero. */
@Injectable()
export class SemearPlanoContasUseCase {
  constructor(
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly repositorio: PlanoContasRepositorioPort,
  ) {}

  async executar(empresaId: string, modelo: ModeloPlanoContas): Promise<ResultadoImportacaoPlanoContas> {
    return this.repositorio.importarLote(empresaId, MODELOS_PLANO_CONTAS[modelo]);
  }
}
