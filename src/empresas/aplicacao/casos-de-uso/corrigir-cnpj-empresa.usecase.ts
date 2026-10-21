import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { validarCnpj } from '../../dominio/empresa';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../portas/empresas-repositorio.port';

/**
 * Correção pontual de um CNPJ já cadastrado errado -- ação rara e sensível (muda a
 * identidade legal da empresa perante o SERPRO), por isso fora do fluxo normal de
 * `AtualizarEmpresaUseCase` (que nem aceita esse campo) e sempre auditada. Só
 * SUPER_ADMIN/CONTADOR_DONO chegam aqui (checado no controller) -- a própria empresa
 * nunca corrige o próprio CNPJ.
 */
@Injectable()
export class CorrigirCnpjEmpresaUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(empresaId: string, novoCnpj: string, executadoPorId: string): Promise<void> {
    const digitos = novoCnpj.replace(/\D/g, '');
    if (!validarCnpj(digitos)) {
      throw new BadRequestException('CNPJ inválido -- confira os dígitos verificadores');
    }

    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }

    const cnpjAntigo = empresa.cnpj;
    if (cnpjAntigo === digitos) {
      return; // já é esse CNPJ, nada a fazer -- evita log de auditoria vazio
    }

    await this.empresasRepositorio.atualizarCnpj(empresaId, digitos);

    await this.auditoria.registrar({
      usuarioId: executadoPorId,
      contadorId: empresa.contadorId,
      empresaId,
      acao: 'empresa.corrigir_cnpj',
      recurso: 'empresas',
      dadosAntigos: { cnpj: cnpjAntigo },
      dadosNovos: { cnpj: digitos },
    });
  }
}
