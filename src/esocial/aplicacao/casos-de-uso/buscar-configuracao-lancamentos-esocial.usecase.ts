import { Inject, Injectable } from '@nestjs/common';
import { ConfiguracaoLancamentosEsocial, ESOCIAL_REPOSITORIO, EsocialRepositorioPort } from '../portas/esocial-repositorio.port';

@Injectable()
export class BuscarConfiguracaoLancamentosEsocialUseCase {
  constructor(@Inject(ESOCIAL_REPOSITORIO) private readonly repositorio: EsocialRepositorioPort) {}

  async executar(empresaId: string): Promise<ConfiguracaoLancamentosEsocial | null> {
    return this.repositorio.buscarConfiguracaoLancamentos(empresaId);
  }
}
