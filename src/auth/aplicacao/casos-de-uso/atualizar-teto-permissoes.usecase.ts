import { Inject, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { Papel } from '../../dominio/papel';
import { PERMISSOES_REPOSITORIO, PermissoesRepositorioPort } from '../portas/permissoes-repositorio.port';
import { USUARIOS_REPOSITORIO, UsuariosRepositorioPort } from '../portas/usuarios-repositorio.port';

/** Substitui o teto (override por dono) de um papel -- contador só pro OPERADOR_CONTADOR da própria carteira, empresa só pro OPERADOR_EMPRESA dela, plataforma pro ADMIN_FINANCEIRO/ADMIN_SUPORTE (resolvido no controller, nunca confia em contadorId/empresaId vindo do cliente). */
@Injectable()
export class AtualizarTetoPermissoesUseCase {
  constructor(
    @Inject(PERMISSOES_REPOSITORIO) private readonly permissoes: PermissoesRepositorioPort,
    @Inject(USUARIOS_REPOSITORIO) private readonly usuarios: UsuariosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(
    papel: Papel,
    contadorId: string | null,
    empresaId: string | null,
    permissaoIds: string[],
    executadoPorId: string,
  ): Promise<void> {
    const papelId = await this.usuarios.buscarIdPapelPorNome(papel);
    await this.permissoes.definirTetoDono(papelId, contadorId, empresaId, permissaoIds);

    await this.auditoria.registrar({
      usuarioId: executadoPorId,
      contadorId,
      empresaId,
      acao: 'ATUALIZAR_TETO_PERMISSOES',
      recurso: `papeis:${papel}`,
      dadosNovos: { permissaoIds },
    });
  }
}
