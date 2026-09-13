import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { UsuarioAutenticado } from '../../../auth/apresentacao/tipos/requisicao-autenticada';
import { USUARIOS_REPOSITORIO, UsuariosRepositorioPort } from '../../../auth/aplicacao/portas/usuarios-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { exigirGestorSobre } from '../exigir-gestor-sobre';
import { FERIAS_PONTO_REPOSITORIO, FeriasPontoRepositorioPort } from '../portas/ferias-ponto-repositorio.port';

@Injectable()
export class CancelarFeriasUseCase {
  constructor(
    @Inject(FERIAS_PONTO_REPOSITORIO) private readonly feriasRepositorio: FeriasPontoRepositorioPort,
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, usuarioAtual: UsuarioAutenticado): Promise<void> {
    const ferias = await this.feriasRepositorio.obterPorId(id);
    if (!ferias) throw new NotFoundException('Férias não encontradas');

    const funcionario = await this.usuariosRepositorio.buscarPorId(ferias.usuarioId);
    if (!funcionario) throw new NotFoundException('Funcionário não encontrado');
    await exigirGestorSobre(usuarioAtual, funcionario, this.empresasRepositorio);

    await this.feriasRepositorio.atualizarStatus(id, 'cancelada');

    await this.auditoria.registrar({
      usuarioId: usuarioAtual.id,
      contadorId: ferias.contadorId,
      empresaId: ferias.empresaId,
      acao: 'CANCELAR_FERIAS',
      recurso: `ponto_ferias:${id}`,
    });
  }
}
