import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { PERMISSOES_REPOSITORIO, PermissoesRepositorioPort } from '../portas/permissoes-repositorio.port';
import { Usuario } from '../portas/usuarios-repositorio.port';

@Injectable()
export class RevogarPermissaoUseCase {
  constructor(
    @Inject(PERMISSOES_REPOSITORIO) private readonly permissoes: PermissoesRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(alvo: Usuario, permissaoId: string, executadoPorId: string): Promise<void> {
    const permissao = await this.permissoes.buscarPermissaoPorId(permissaoId);
    if (!permissao) {
      throw new NotFoundException('Permissão não encontrada');
    }

    await this.permissoes.revogar(alvo.id, permissaoId);

    await this.auditoria.registrar({
      usuarioId: executadoPorId,
      contadorId: alvo.contadorId,
      empresaId: alvo.empresaId,
      acao: 'REVOGAR_PERMISSAO',
      recurso: `usuarios:${alvo.id}`,
      dadosAntigos: { permissao: permissao.chave },
    });
  }
}
