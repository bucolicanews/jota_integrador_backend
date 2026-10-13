import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ehPapelDePlataforma, Papel } from '../../../auth/dominio/papel';
import {
  EMPRESAS_REPOSITORIO,
  Empresa,
  EmpresasRepositorioPort,
} from '../portas/empresas-repositorio.port';

export interface EntradaObterEmpresaInterna {
  papel: Papel;
  contadorId: string | null;
}

/**
 * Resolve o workspace fixo de quem não tem carteira de empresas-cliente: a "interna_plataforma"
 * pra papéis de plataforma, a "interna_contador" pro contador dono/operador. Sempre uma das
 * duas existe (seedada/auto-criada na criação do contador -- ver criar-contador.usecase.ts).
 */
@Injectable()
export class ObterEmpresaInternaUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
  ) {}

  async executar(entrada: EntradaObterEmpresaInterna): Promise<Empresa> {
    const empresa = ehPapelDePlataforma(entrada.papel)
      ? await this.empresasRepositorio.buscarEmpresaInternaDaPlataforma()
      : entrada.contadorId
        ? await this.empresasRepositorio.buscarEmpresaInternaDoContador(entrada.contadorId)
        : null;

    if (!empresa) {
      throw new NotFoundException('Empresa interna não encontrada');
    }
    return empresa;
  }
}
