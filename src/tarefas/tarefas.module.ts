import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { AdicionarAnexoTarefaUseCase } from './aplicacao/casos-de-uso/adicionar-anexo-tarefa.usecase';
import { AdicionarMembroEquipeUseCase } from './aplicacao/casos-de-uso/adicionar-membro-equipe.usecase';
import { AtualizarColunaUseCase } from './aplicacao/casos-de-uso/atualizar-coluna.usecase';
import { AtualizarComentarioTarefaUseCase } from './aplicacao/casos-de-uso/atualizar-comentario-tarefa.usecase';
import { AtualizarQuadroUseCase } from './aplicacao/casos-de-uso/atualizar-quadro.usecase';
import { AtualizarTarefaUseCase } from './aplicacao/casos-de-uso/atualizar-tarefa.usecase';
import { CriarColunaUseCase } from './aplicacao/casos-de-uso/criar-coluna.usecase';
import { CriarComentarioTarefaUseCase } from './aplicacao/casos-de-uso/criar-comentario-tarefa.usecase';
import { CriarQuadroUseCase } from './aplicacao/casos-de-uso/criar-quadro.usecase';
import { CriarTarefaUseCase } from './aplicacao/casos-de-uso/criar-tarefa.usecase';
import { ExcluirColunaUseCase } from './aplicacao/casos-de-uso/excluir-coluna.usecase';
import { ExcluirComentarioTarefaUseCase } from './aplicacao/casos-de-uso/excluir-comentario-tarefa.usecase';
import { ExcluirQuadroUseCase } from './aplicacao/casos-de-uso/excluir-quadro.usecase';
import { ExcluirTarefaUseCase } from './aplicacao/casos-de-uso/excluir-tarefa.usecase';
import { ListarAnexosTarefaUseCase } from './aplicacao/casos-de-uso/listar-anexos-tarefa.usecase';
import { ListarComentariosTarefaUseCase } from './aplicacao/casos-de-uso/listar-comentarios-tarefa.usecase';
import { ListarEquipeTarefaUseCase } from './aplicacao/casos-de-uso/listar-equipe-tarefa.usecase';
import { ListarFeedTarefasUseCase } from './aplicacao/casos-de-uso/listar-feed-tarefas.usecase';
import { ListarHistoricoTarefaUseCase } from './aplicacao/casos-de-uso/listar-historico-tarefa.usecase';
import { ListarNotificacoesUseCase } from './aplicacao/casos-de-uso/listar-notificacoes.usecase';
import { ListarQuadrosUseCase } from './aplicacao/casos-de-uso/listar-quadros.usecase';
import { ListarTarefasUseCase } from './aplicacao/casos-de-uso/listar-tarefas.usecase';
import { MarcarNotificacaoLidaUseCase } from './aplicacao/casos-de-uso/marcar-notificacao-lida.usecase';
import { MoverTarefaUseCase } from './aplicacao/casos-de-uso/mover-tarefa.usecase';
import { ObterUrlAnexoTarefaUseCase } from './aplicacao/casos-de-uso/obter-url-anexo-tarefa.usecase';
import { RemoverMembroEquipeUseCase } from './aplicacao/casos-de-uso/remover-membro-equipe.usecase';
import { ReordenarColunasUseCase } from './aplicacao/casos-de-uso/reordenar-colunas.usecase';
import { NOTIFICACOES_REPOSITORIO } from './aplicacao/portas/notificacoes-repositorio.port';
import { QUADROS_TAREFAS_REPOSITORIO } from './aplicacao/portas/quadros-tarefas-repositorio.port';
import { TAREFAS_REPOSITORIO } from './aplicacao/portas/tarefas-repositorio.port';
import { NotificacoesController } from './apresentacao/notificacoes.controller';
import { TarefasController } from './apresentacao/tarefas.controller';
import { NotificacoesRepositorioSupabase } from './infraestrutura/notificacoes.repositorio.supabase';
import { QuadrosTarefasRepositorioSupabase } from './infraestrutura/quadros-tarefas.repositorio.supabase';
import { StorageTarefasAnexosService } from './infraestrutura/storage-tarefas-anexos.service';
import { TarefasRepositorioSupabase } from './infraestrutura/tarefas.repositorio.supabase';

@Module({
  imports: [EmpresasModule],
  controllers: [TarefasController, NotificacoesController],
  providers: [
    { provide: QUADROS_TAREFAS_REPOSITORIO, useClass: QuadrosTarefasRepositorioSupabase },
    { provide: TAREFAS_REPOSITORIO, useClass: TarefasRepositorioSupabase },
    { provide: NOTIFICACOES_REPOSITORIO, useClass: NotificacoesRepositorioSupabase },
    StorageTarefasAnexosService,
    ListarQuadrosUseCase,
    CriarQuadroUseCase,
    AtualizarQuadroUseCase,
    ExcluirQuadroUseCase,
    CriarColunaUseCase,
    AtualizarColunaUseCase,
    ReordenarColunasUseCase,
    ExcluirColunaUseCase,
    CriarTarefaUseCase,
    ListarTarefasUseCase,
    AtualizarTarefaUseCase,
    MoverTarefaUseCase,
    ExcluirTarefaUseCase,
    ListarHistoricoTarefaUseCase,
    AdicionarAnexoTarefaUseCase,
    ListarAnexosTarefaUseCase,
    ObterUrlAnexoTarefaUseCase,
    ListarNotificacoesUseCase,
    MarcarNotificacaoLidaUseCase,
    CriarComentarioTarefaUseCase,
    ListarComentariosTarefaUseCase,
    AtualizarComentarioTarefaUseCase,
    ExcluirComentarioTarefaUseCase,
    ListarFeedTarefasUseCase,
    AdicionarMembroEquipeUseCase,
    RemoverMembroEquipeUseCase,
    ListarEquipeTarefaUseCase,
  ],
})
export class TarefasModule {}
