import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLIENTES_REPOSITORIO, ClientesRepositorioPort } from '../portas/clientes-repositorio.port';

@Injectable()
export class AlternarAtivoClienteUseCase {
  constructor(@Inject(CLIENTES_REPOSITORIO) private readonly repositorio: ClientesRepositorioPort) {}

  async executar(id: string, empresaId: string, ativo: boolean): Promise<void> {
    const cliente = await this.repositorio.obterPorId(id);
    if (!cliente || cliente.empresaId !== empresaId) {
      throw new NotFoundException('Cliente não encontrado');
    }
    await this.repositorio.marcarAtivo(id, ativo);
  }
}
