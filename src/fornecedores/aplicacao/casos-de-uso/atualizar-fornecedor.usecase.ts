import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { validarDocumentoSePresente } from '../../dominio/fornecedor';
import { DadosFornecedor, FORNECEDORES_REPOSITORIO, FornecedoresRepositorioPort } from '../portas/fornecedores-repositorio.port';

@Injectable()
export class AtualizarFornecedorUseCase {
  constructor(@Inject(FORNECEDORES_REPOSITORIO) private readonly repositorio: FornecedoresRepositorioPort) {}

  async executar(id: string, empresaId: string, dados: Partial<DadosFornecedor>): Promise<void> {
    const fornecedor = await this.repositorio.obterPorId(id);
    if (!fornecedor || fornecedor.empresaId !== empresaId) {
      throw new NotFoundException('Fornecedor não encontrado');
    }
    if (dados.documento !== undefined && !validarDocumentoSePresente(dados.documento)) {
      throw new BadRequestException('CPF/CNPJ inválido');
    }
    await this.repositorio.atualizar(id, dados);
  }
}
