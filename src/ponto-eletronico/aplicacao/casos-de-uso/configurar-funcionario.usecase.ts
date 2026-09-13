import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { UsuarioAutenticado } from '../../../auth/apresentacao/tipos/requisicao-autenticada';
import { USUARIOS_REPOSITORIO, UsuariosRepositorioPort } from '../../../auth/aplicacao/portas/usuarios-repositorio.port';
import { exigirGestorSobre } from '../exigir-gestor-sobre';
import {
  CONFIGURACAO_FUNCIONARIO_REPOSITORIO,
  ConfiguracaoFuncionario,
  ConfiguracaoFuncionarioRepositorioPort,
  DadosConfiguracaoFuncionario,
} from '../portas/configuracao-funcionario-repositorio.port';

@Injectable()
export class ConfigurarFuncionarioUseCase {
  constructor(
    @Inject(CONFIGURACAO_FUNCIONARIO_REPOSITORIO) private readonly configuracaoRepositorio: ConfiguracaoFuncionarioRepositorioPort,
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(usuarioAlvoId: string, dados: DadosConfiguracaoFuncionario, usuarioAtual: UsuarioAutenticado): Promise<ConfiguracaoFuncionario> {
    const funcionario = await this.usuariosRepositorio.buscarPorId(usuarioAlvoId);
    if (!funcionario) throw new NotFoundException('Funcionário não encontrado');
    exigirGestorSobre(usuarioAtual, funcionario);

    const configuracao = await this.configuracaoRepositorio.upsert(usuarioAlvoId, dados);

    await this.auditoria.registrar({
      usuarioId: usuarioAtual.id,
      contadorId: funcionario.contadorId,
      empresaId: funcionario.empresaId,
      acao: 'CONFIGURAR_JORNADA_FUNCIONARIO',
      recurso: `ponto_configuracao_funcionario:${usuarioAlvoId}`,
      dadosNovos: dados,
    });

    return configuracao;
  }
}
