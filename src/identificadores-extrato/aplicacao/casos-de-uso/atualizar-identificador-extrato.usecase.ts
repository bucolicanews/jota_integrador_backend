import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DadosIdentificadorExtrato, IDENTIFICADORES_EXTRATO_REPOSITORIO, IdentificadoresExtratoRepositorioPort } from '../portas/identificadores-extrato-repositorio.port';

@Injectable()
export class AtualizarIdentificadorExtratoUseCase {
  constructor(@Inject(IDENTIFICADORES_EXTRATO_REPOSITORIO) private readonly repositorio: IdentificadoresExtratoRepositorioPort) {}

  async executar(id: string, empresaId: string, dados: Partial<DadosIdentificadorExtrato>): Promise<void> {
    const item = await this.repositorio.obterPorId(id);
    if (!item || item.empresaId !== empresaId) {
      throw new NotFoundException('Identificador não encontrado');
    }
    await this.repositorio.atualizar(id, dados);
  }
}
