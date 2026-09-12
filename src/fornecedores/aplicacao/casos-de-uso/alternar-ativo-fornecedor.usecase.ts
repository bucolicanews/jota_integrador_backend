import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FORNECEDORES_REPOSITORIO, FornecedoresRepositorioPort } from '../portas/fornecedores-repositorio.port';

@Injectable()
export class AlternarAtivoFornecedorUseCase {
  constructor(@Inject(FORNECEDORES_REPOSITORIO) private readonly repositorio: FornecedoresRepositorioPort) {}

  async executar(id: string, empresaId: string, ativo: boolean): Promise<void> {
    const fornecedor = await this.repositorio.obterPorId(id);
    if (!fornecedor || fornecedor.empresaId !== empresaId) {
      throw new NotFoundException('Fornecedor não encontrado');
    }
    await this.repositorio.marcarAtivo(id, ativo);
  }
}
