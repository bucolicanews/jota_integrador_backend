import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UsuarioAutenticado } from '../../../auth/apresentacao/tipos/requisicao-autenticada';
import { USUARIOS_REPOSITORIO, UsuariosRepositorioPort } from '../../../auth/aplicacao/portas/usuarios-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { StoragePontoService } from '../../infraestrutura/storage-ponto.service';
import { exigirGestorSobre } from '../exigir-gestor-sobre';
import { REGISTROS_PONTO_REPOSITORIO, RegistrosPontoRepositorioPort } from '../portas/registros-ponto-repositorio.port';
import { UrlArquivoPonto } from './obter-url-selfie.usecase';

@Injectable()
export class ObterUrlAtestadoUseCase {
  constructor(
    @Inject(REGISTROS_PONTO_REPOSITORIO) private readonly registrosRepositorio: RegistrosPontoRepositorioPort,
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly storage: StoragePontoService,
  ) {}

  async executar(registroId: string, usuarioAtual: UsuarioAutenticado): Promise<UrlArquivoPonto> {
    const registro = await this.registrosRepositorio.obterPorId(registroId);
    if (!registro || !registro.atestadoStorageRef) throw new NotFoundException('Atestado não encontrado');

    if (registro.usuarioId !== usuarioAtual.id) {
      const funcionario = await this.usuariosRepositorio.buscarPorId(registro.usuarioId);
      if (!funcionario) throw new NotFoundException('Funcionário não encontrado');
      await exigirGestorSobre(usuarioAtual, funcionario, this.empresasRepositorio);
    }

    return this.storage.gerarUrlAssinadaAtestado(registro.atestadoStorageRef);
  }
}
