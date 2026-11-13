export interface Coluna {
  id: string;
  quadroId: string;
  nome: string;
  ordem: number;
  /** Mover um card pra aqui dispara a notificação bumerangue pro criado_por da tarefa. */
  ehFinal: boolean;
}

export interface QuadroTarefas {
  id: string;
  empresaId: string;
  nome: string;
}

export interface QuadroComColunas extends QuadroTarefas {
  colunas: Coluna[];
}

export interface DadosNovaColuna {
  quadroId: string;
  nome: string;
  ordem: number;
  ehFinal: boolean;
}

export interface DadosAtualizarColuna {
  nome?: string;
  ehFinal?: boolean;
}

export interface QuadrosTarefasRepositorioPort {
  /** N quadros por empresa (não é mais 1 fixo) -- cada um já vem com as próprias colunas. */
  listarPorEmpresa(empresaId: string): Promise<QuadroComColunas[]>;
  obterPorId(id: string): Promise<QuadroComColunas | null>;
  criar(empresaId: string, nome: string): Promise<QuadroTarefas>;
  atualizar(id: string, nome: string): Promise<void>;
  excluir(id: string): Promise<void>;
  listarColunas(quadroId: string): Promise<Coluna[]>;
  criarColuna(dados: DadosNovaColuna): Promise<Coluna>;
  atualizarColuna(id: string, dados: DadosAtualizarColuna): Promise<void>;
  reordenarColunas(ordens: { id: string; ordem: number }[]): Promise<void>;
  excluirColuna(id: string): Promise<void>;
  obterColunaPorId(id: string): Promise<Coluna | null>;
}

export const QUADROS_TAREFAS_REPOSITORIO = Symbol('QUADROS_TAREFAS_REPOSITORIO');
