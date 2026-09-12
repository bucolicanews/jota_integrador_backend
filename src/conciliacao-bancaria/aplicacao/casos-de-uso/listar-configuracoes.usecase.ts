import { Inject, Injectable } from '@nestjs/common';
import {
  CONCILIACAO_REPOSITORIO,
  ConciliacaoRepositorioPort,
  ConfiguracaoConciliacao,
} from '../portas/conciliacao-repositorio.port';

@Injectable()
export class ListarConfiguracoesUseCase {
  constructor(@Inject(CONCILIACAO_REPOSITORIO) private readonly repositorio: ConciliacaoRepositorioPort) {}

  async executar(empresaId: string, contaContabilId?: string): Promise<ConfiguracaoConciliacao[]> {
    return this.repositorio.listarConfiguracoes(empresaId, contaContabilId);
  }
}
