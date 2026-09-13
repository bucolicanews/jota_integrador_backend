import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { UsuarioAutenticado } from '../../../auth/apresentacao/tipos/requisicao-autenticada';
import { USUARIOS_REPOSITORIO, UsuariosRepositorioPort } from '../../../auth/aplicacao/portas/usuarios-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { exigirGestorSobre } from '../exigir-gestor-sobre';
import { REGISTROS_PONTO_REPOSITORIO, RegistrosPontoRepositorioPort } from '../portas/registros-ponto-repositorio.port';

@Injectable()
export class ExcluirRegistroUseCase {
  constructor(
    @Inject(REGISTROS_PONTO_REPOSITORIO) private readonly registrosRepositorio: RegistrosPontoRepositorioPort,
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, usuarioAtual: UsuarioAutenticado): Promise<void> {
    const registro = await this.registrosRepositorio.obterPorId(id);
    if (!registro) throw new NotFoundException('Registro não encontrado');

    const funcionario = await this.usuariosRepositorio.buscarPorId(registro.usuarioId);
    if (!funcionario) throw new NotFoundException('Funcionário não encontrado');
    await exigirGestorSobre(usuarioAtual, funcionario, this.empresasRepositorio);

    await this.registrosRepositorio.excluir(id);

    await this.auditoria.registrar({
      usuarioId: usuarioAtual.id,
      contadorId: registro.contadorId,
      empresaId: registro.empresaId,
      acao: 'EXCLUIR_REGISTRO_PONTO',
      recurso: `ponto_registros:${id}`,
      dadosAntigos: { tipo: registro.tipo, horarioRegistro: registro.horarioRegistro },
    });
  }
}
