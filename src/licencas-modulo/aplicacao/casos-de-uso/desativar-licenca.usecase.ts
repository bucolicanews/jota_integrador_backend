import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { podeDesativar } from '../../dominio/licenca-modulo';
import { LICENCAS_MODULO_REPOSITORIO, LicencasModuloRepositorioPort } from '../portas/licencas-modulo-repositorio.port';

/** Libera a empresa (volta pra status=disponivel, empresa_id=null) -- contador pode reativar em outra empresa depois. Não mexe no contrato/cobrança já gerados (ficam como histórico). */
@Injectable()
export class DesativarLicencaUseCase {
  constructor(@Inject(LICENCAS_MODULO_REPOSITORIO) private readonly repositorio: LicencasModuloRepositorioPort) {}

  async executar(licencaId: string, contadorId: string): Promise<void> {
    const licenca = await this.repositorio.obterPorId(licencaId);
    if (!licenca || licenca.contadorId !== contadorId) {
      throw new NotFoundException('Licença não encontrada');
    }
    if (!podeDesativar(licenca.status)) {
      throw new BadRequestException('Licença não está ativa');
    }

    await this.repositorio.desativar(licencaId);
  }
}
