import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { validarDocumentoSePresente } from '../../dominio/fornecedor';
import { DadosFornecedor, FORNECEDORES_REPOSITORIO, Fornecedor, FornecedoresRepositorioPort } from '../portas/fornecedores-repositorio.port';

@Injectable()
export class CriarFornecedorUseCase {
  constructor(@Inject(FORNECEDORES_REPOSITORIO) private readonly repositorio: FornecedoresRepositorioPort) {}

  async executar(dados: DadosFornecedor): Promise<Fornecedor> {
    if (!validarDocumentoSePresente(dados.documento)) {
      throw new BadRequestException('CPF/CNPJ inválido');
    }
    return this.repositorio.criar(dados);
  }
}
