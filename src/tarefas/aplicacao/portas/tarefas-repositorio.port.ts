export type PrioridadeTarefa = 'baixa' | 'media' | 'alta';

export interface Tarefa {
  id: string;
  empresaId: string;
  quadroId: string;
  colunaId: string;
  titulo: string;
  descricao: string | null;
  criadoPor: string;
  atribuidoA: string | null;
  prioridade: PrioridadeTarefa;
  prazo: string | null;
  tempoEstimadoHoras: number | null;
  ordem: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DadosNovaTarefa {
  empresaId: string;
  quadroId: string;
  colunaId: string;
  titulo: string;
  descricao: string | null;
  criadoPor: string;
  atribuidoA: string | null;
  prioridade: PrioridadeTarefa;
  prazo: string | null;
  tempoEstimadoHoras: number | null;
  ordem: number;
}

export interface DadosAtualizarTarefa {
  titulo?: string;
  descricao?: string | null;
  atribuidoA?: string | null;
  prioridade?: PrioridadeTarefa;
  prazo?: string | null;
  tempoEstimadoHoras?: number | null;
}

export interface MovimentoHistorico {
  id: string;
  tarefaId: string;
  colunaOrigemId: string | null;
  colunaDestinoId: string;
  movidoPor: string;
  /** Quem ficou responsável NESSA etapa -- distinto de Tarefa.atribuidoA, pode mudar movimento a movimento. */
  responsavelId: string | null;
  criadoEm: string;
}

export interface ComentarioTarefa {
  id: string;
  tarefaId: string;
  autorId: string;
  corpo: string;
  criadoEm: string;
}

export interface AnexoTarefa {
  id: string;
  tarefaId: string;
  nomeArquivo: string;
  storageRef: string;
  criadoPor: string;
  criadoEm: string;
}

export interface AtribuicaoHistorico {
  id: string;
  tarefaId: string;
  deUsuarioId: string | null;
  paraUsuarioId: string | null;
  atribuidoPor: string;
  criadoEm: string;
}

export interface MembroEquipeTarefa {
  id: string;
  tarefaId: string;
  usuarioId: string;
  adicionadoPor: string;
  criadoEm: string;
}

/** Entrada unificada do feed por empresa -- `tipo` distingue o que preencher na UI, o resto é opcional conforme o tipo. */
export type TipoEventoFeedTarefas = 'comentario' | 'movimentacao' | 'anexo' | 'atribuicao';

export interface EventoFeedTarefas {
  tipo: TipoEventoFeedTarefas;
  tarefaId: string;
  criadoEm: string;
  comentario?: ComentarioTarefa;
  movimento?: MovimentoHistorico;
  anexo?: AnexoTarefa;
  atribuicao?: AtribuicaoHistorico;
}

export interface TarefasRepositorioPort {
  criar(dados: DadosNovaTarefa): Promise<Tarefa>;
  listarPorEmpresa(empresaId: string): Promise<Tarefa[]>;
  obterPorId(id: string): Promise<Tarefa | null>;
  atualizar(id: string, dados: DadosAtualizarTarefa): Promise<void>;
  /** `quadroId` muda também -- tarefa pode migrar de quadro, não só de coluna dentro do mesmo. */
  mover(id: string, quadroId: string, colunaId: string, ordem: number): Promise<void>;
  excluir(id: string): Promise<void>;
  /** Usado por ExcluirColunaUseCase -- nunca excluir coluna com tarefa dentro. */
  contarPorColuna(colunaId: string): Promise<number>;
  /** Usado por ExcluirQuadroUseCase -- nunca excluir quadro com tarefa dentro. */
  contarPorQuadro(quadroId: string): Promise<number>;
  registrarMovimento(dados: {
    tarefaId: string;
    colunaOrigemId: string | null;
    colunaDestinoId: string;
    movidoPor: string;
    responsavelId: string | null;
  }): Promise<void>;
  listarHistorico(tarefaId: string): Promise<MovimentoHistorico[]>;
  /** Todo o histórico de movimentação das tarefas de UMA empresa -- usado só pelo feed. */
  listarHistoricoPorEmpresa(empresaId: string): Promise<MovimentoHistorico[]>;

  criarComentario(tarefaId: string, autorId: string, corpo: string): Promise<ComentarioTarefa>;
  listarComentarios(tarefaId: string): Promise<ComentarioTarefa[]>;
  /** Todos os comentários das tarefas de UMA empresa -- usado só pelo feed. */
  listarComentariosPorEmpresa(empresaId: string): Promise<ComentarioTarefa[]>;
  obterComentarioPorId(id: string): Promise<ComentarioTarefa | null>;
  atualizarComentario(id: string, corpo: string): Promise<void>;
  excluirComentario(id: string): Promise<void>;

  adicionarAnexo(tarefaId: string, nomeArquivo: string, storageRef: string, criadoPor: string): Promise<AnexoTarefa>;
  listarAnexos(tarefaId: string): Promise<AnexoTarefa[]>;
  obterAnexo(id: string): Promise<AnexoTarefa | null>;
  /** Todos os anexos das tarefas de UMA empresa -- usado só pelo feed. */
  listarAnexosPorEmpresa(empresaId: string): Promise<AnexoTarefa[]>;

  registrarAtribuicao(dados: {
    tarefaId: string;
    deUsuarioId: string | null;
    paraUsuarioId: string | null;
    atribuidoPor: string;
  }): Promise<void>;
  /** Todo o histórico de reatribuição das tarefas de UMA empresa -- usado só pelo feed. */
  listarAtribuicoesPorEmpresa(empresaId: string): Promise<AtribuicaoHistorico[]>;

  adicionarMembroEquipe(tarefaId: string, usuarioId: string, adicionadoPor: string): Promise<MembroEquipeTarefa>;
  removerMembroEquipe(tarefaId: string, usuarioId: string): Promise<void>;
  listarEquipe(tarefaId: string): Promise<MembroEquipeTarefa[]>;
}

export const TAREFAS_REPOSITORIO = Symbol('TAREFAS_REPOSITORIO');
