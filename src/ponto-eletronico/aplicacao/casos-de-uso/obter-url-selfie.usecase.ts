import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UsuarioAutenticado } from '../../../auth/apresentacao/tipos/requisicao-autenticada';
import { USUARIOS_REPOSITORIO, UsuariosRepositorioPort } from '../../../auth/aplicacao/portas/usuarios-repositorio.port';
import { StoragePontoService } from '../../infraestrutura/storage-ponto.service';
import { exigirGestorSobre } from '../exigir-gestor-sobre';
import { REGISTROS_PONTO_REPOSITORIO, RegistrosPontoRepositorioPort } from '../portas/registros-ponto-repositorio.port';

export interface UrlArquivoPonto {
  url: string;
  expiraEmSegundos: number;
}

@Injectable()
export class ObterUrlSelfieUseCase {
  constructor(
    @Inject(REGISTROS_PONTO_REPOSITORIO) private readonly registrosRepositorio: RegistrosPontoRepositorioPort,
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    private readonly storage: StoragePontoService,
  ) {}

  async executar(registroId: string, usuarioAtual: UsuarioAutenticado): Promise<UrlArquivoPonto> {
    const registro = await this.registrosRepositorio.obterPorId(registroId);
    if (!registro || !registro.selfieStorageRef) throw new NotFoundException('Selfie não encontrada');

    if (registro.usuarioId !== usuarioAtual.id) {
      const funcionario = await this.usuariosRepositorio.buscarPorId(registro.usuarioId);
      if (!funcionario) throw new NotFoundException('Funcionário não encontrado');
      exigirGestorSobre(usuarioAtual, funcionario);
    }

    return this.storage.gerarUrlAssinadaSelfie(registro.selfieStorageRef);
  }
}
