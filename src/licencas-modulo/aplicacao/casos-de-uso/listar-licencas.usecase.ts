import { Inject, Injectable } from '@nestjs/common';
import { LICENCAS_MODULO_REPOSITORIO, LicencaModulo, LicencasModuloRepositorioPort } from '../portas/licencas-modulo-repositorio.port';

@Injectable()
export class ListarLicencasUseCase {
  constructor(@Inject(LICENCAS_MODULO_REPOSITORIO) private readonly repositorio: LicencasModuloRepositorioPort) {}

  async executar(contadorId: string): Promise<LicencaModulo[]> {
    return this.repositorio.listarPorContador(contadorId);
  }
}
