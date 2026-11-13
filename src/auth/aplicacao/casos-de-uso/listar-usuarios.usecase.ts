import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ListarEmpresasUseCase } from '../../../empresas/aplicacao/casos-de-uso/listar-empresas.usecase';
import { StorageAvataresService } from '../../infraestrutura/storage-avatares.service';
import { USUARIOS_REPOSITORIO, Usuario, UsuariosRepositorioPort } from '../portas/usuarios-repositorio.port';

export interface FiltroListarUsuarios {
  contadorId: string | null;
  /** Uma empresa específica, pra restringir a listagem só à equipe dela. */
  empresaIdUnico: string | null;
  /** SUPER_ADMIN vendo usuários de plataforma (SUPER_ADMIN/ADMIN_FINANCEIRO/ADMIN_SUPORTE) -- nunca tinha como aparecer nesta listagem antes (contador_id e empresa_id são sempre null pra eles). */
  plataforma?: boolean;
  /** Só a equipe do próprio escritório (OPERADOR_CONTADOR) -- exclui a equipe de toda empresa-cliente, ao contrário do default "carteira inteira" de hoje. Ignorado se `empresaIdUnico` também vier. */
  somenteProprio?: boolean;
}

@Injectable()
export class ListarUsuariosUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    private readonly listarEmpresas: ListarEmpresasUseCase,
    private readonly storageAvatares: StorageAvataresService,
  ) {}

  async executar(filtro: FiltroListarUsuarios): Promise<Usuario[]> {
    const usuarios = await this.buscar(filtro);
    return this.resolverAvatares(usuarios);
  }

  private async buscar(filtro: FiltroListarUsuarios): Promise<Usuario[]> {
    if (filtro.plataforma) {
      return this.usuariosRepositorio.listar({ contadorId: null, empresaIds: [], plataforma: true });
    }

    // Escopo plataforma direto numa empresa (SUPER_ADMIN) ou o próprio empresário vendo
    // a própria equipe -- controller já garantiu a autoridade, sem checagem extra aqui.
    if (!filtro.contadorId && filtro.empresaIdUnico) {
      return this.usuariosRepositorio.listar({ contadorId: null, empresaIds: [filtro.empresaIdUnico] });
    }

    if (!filtro.contadorId) {
      return [];
    }

    if (filtro.somenteProprio) {
      return this.usuariosRepositorio.listar({ contadorId: filtro.contadorId, empresaIds: [] });
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

  /**
   * `avatarUrl` cru do banco é o storage ref (path no bucket), nunca URL pública --
   * resolvido aqui em lote (1 request, não 1 por usuário) pra alimentar picker de
   * "atribuir a"/avatar de card do módulo Tarefas sem N chamadas. Se a signed URL falhar
   * pra algum usuário (bucket indisponível etc), não derruba a listagem inteira -- cai
   * pra null, mesmo efeito de não ter avatar.
   */
  private async resolverAvatares(usuarios: Usuario[]): Promise<Usuario[]> {
    return Promise.all(
      usuarios.map(async (usuario) => {
        if (!usuario.avatarUrl) return usuario;
        try {
          const urlAssinada = await this.storageAvatares.gerarUrlAssinada(usuario.avatarUrl);
          return { ...usuario, avatarUrl: urlAssinada };
        } catch {
          return { ...usuario, avatarUrl: null };
        }
      }),
    );
  }
}
