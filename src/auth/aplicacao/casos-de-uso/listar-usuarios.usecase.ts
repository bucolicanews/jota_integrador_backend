import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ListarEmpresasUseCase } from '../../../empresas/aplicacao/casos-de-uso/listar-empresas.usecase';
import { USUARIOS_REPOSITORIO, Usuario, UsuariosRepositorioPort } from '../portas/usuarios-repositorio.port';

export interface FiltroListarUsuarios {
  contadorId: string | null;
  /** Uma empresa específica, pra restringir a listagem só à equipe dela. */
  empresaIdUnico: string | null;
}

@Injectable()
export class ListarUsuariosUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    private readonly listarEmpresas: ListarEmpresasUseCase,
  ) {}

  async executar(filtro: FiltroListarUsuarios): Promise<Usuario[]> {
    // Escopo plataforma direto numa empresa (SUPER_ADMIN) ou o próprio empresário vendo
    // a própria equipe -- controller já garantiu a autoridade, sem checagem extra aqui.
    if (!filtro.contadorId && filtro.empresaIdUnico) {
      return this.usuariosRepositorio.listar({ contadorId: null, empresaIds: [filtro.empresaIdUnico] });
    }

    if (!filtro.contadorId) {
      return [];
    }

    const empresasDaCarteira = await this.listarEmpresas.executar(filtro.contadorId);

    // Contador narrowing pra uma única empresa da própria carteira -- reconfirma posse
    // (Zero Trust) antes de devolver, já que o `empresaId` pode ter vindo de query string.
    if (filtro.empresaIdUnico) {
      const pertence = empresasDaCarteira.some((empresa) => empresa.id === filtro.empresaIdUnico);
      if (!pertence) {
        throw new ForbiddenException('Esta empresa não pertence à carteira deste contador');
      }
      return this.usuariosRepositorio.listar({ contadorId: null, empresaIds: [filtro.empresaIdUnico] });
    }

    // Carteira inteira: próprio escritório (contador_id) + equipe de todas as empresas.
    const empresaIds = empresasDaCarteira.map((empresa) => empresa.id);
    return this.usuariosRepositorio.listar({ contadorId: filtro.contadorId, empresaIds });
  }
}
