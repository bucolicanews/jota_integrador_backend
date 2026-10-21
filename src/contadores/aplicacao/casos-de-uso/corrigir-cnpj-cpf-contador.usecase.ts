import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { validarCpfOuCnpj } from '../../dominio/contador';
import { CONTADORES_REPOSITORIO, ContadoresRepositorioPort } from '../portas/contadores-repositorio.port';

/**
 * Correção pontual de um CPF/CNPJ já cadastrado errado -- ação rara e sensível (muda a
 * identidade legal do contador), por isso fora do fluxo normal de `AtualizarContadorUseCase`
 * (que nem aceita esse campo) e sempre auditada. Mesma checagem de posse do endpoint
 * `atualizar()` já existente no controller (admin/plataforma OU o próprio contador).
 */
@Injectable()
export class CorrigirCnpjCpfContadorUseCase {
  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(contadorId: string, novoCnpjCpf: string, executadoPorId: string): Promise<void> {
    const digitos = novoCnpjCpf.replace(/\D/g, '');
    if (!validarCpfOuCnpj(digitos)) {
      throw new BadRequestException('CPF/CNPJ inválido -- confira os dígitos verificadores');
    }

    const contador = await this.contadoresRepositorio.buscarPorId(contadorId);
    if (!contador) {
      throw new NotFoundException('Contador não encontrado');
    }

    const documentoAntigo = contador.cnpjCpf;
    if (documentoAntigo === digitos) {
      return; // já é esse documento, nada a fazer -- evita log de auditoria vazio
    }

    // cnpj_cpf não tem unique constraint no banco (ao contrário de empresas.cnpj) --
    // checagem de duplicado fica na aplicação mesmo.
    const existente = await this.contadoresRepositorio.buscarPorCnpjCpf(digitos);
    if (existente && existente.id !== contadorId) {
      throw new ConflictException('Este CPF/CNPJ já está cadastrado em outro contador');
    }

    await this.contadoresRepositorio.atualizarCnpjCpf(contadorId, digitos);

    await this.auditoria.registrar({
      usuarioId: executadoPorId,
      contadorId,
      acao: 'contador.corrigir_cnpj_cpf',
      recurso: 'contadores',
      dadosAntigos: { cnpjCpf: documentoAntigo },
      dadosNovos: { cnpjCpf: digitos },
    });
  }
}
