import { Inject, Injectable } from '@nestjs/common';
import {
  CONFIGURACAO_FUNCIONARIO_REPOSITORIO,
  ConfiguracaoFuncionario,
  ConfiguracaoFuncionarioRepositorioPort,
} from '../portas/configuracao-funcionario-repositorio.port';

/** Posse (próprio funcionário ou gestor) já validada pelo controller antes de chamar. */
@Injectable()
export class ObterConfiguracaoFuncionarioUseCase {
  constructor(@Inject(CONFIGURACAO_FUNCIONARIO_REPOSITORIO) private readonly configuracaoRepositorio: ConfiguracaoFuncionarioRepositorioPort) {}

  async executar(usuarioId: string): Promise<ConfiguracaoFuncionario | null> {
    return this.configuracaoRepositorio.obterPorUsuario(usuarioId);
  }
}
