export interface ConfiguracaoFuncionario {
  usuarioId: string;
  salario: number | null;
  horasMensais: number;
  diasFolgaFixos: string[];
  folgaDomingoObrigatoria: boolean;
  dataInicioContrato: string | null;
}

export interface DadosConfiguracaoFuncionario {
  salario?: number | null;
  horasMensais?: number;
  diasFolgaFixos?: string[];
  folgaDomingoObrigatoria?: boolean;
  dataInicioContrato?: string | null;
}

export interface ConfiguracaoFuncionarioRepositorioPort {
  obterPorUsuario(usuarioId: string): Promise<ConfiguracaoFuncionario | null>;
  /** Cria se não existe, senão atualiza -- 1:1 com usuarios, nunca faz sentido ter dois caminhos separados de criar/atualizar. */
  upsert(usuarioId: string, dados: DadosConfiguracaoFuncionario): Promise<ConfiguracaoFuncionario>;
}

export const CONFIGURACAO_FUNCIONARIO_REPOSITORIO = Symbol('CONFIGURACAO_FUNCIONARIO_REPOSITORIO');
