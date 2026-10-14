import { Inject, Injectable } from '@nestjs/common';
import { ASSINATURAS_REPOSITORIO, Assinatura, AssinaturasRepositorioPort } from '../portas/assinaturas-repositorio.port';

@Injectable()
export class ObterAssinaturaAtualUseCase {
  constructor(
    @Inject(ASSINATURAS_REPOSITORIO) private readonly repositorio: AssinaturasRepositorioPort,
  ) {}

  async executar(empresaId: string): Promise<Assinatura | null> {
    return this.repositorio.buscarPorEmpresa(empresaId);
  }
}
