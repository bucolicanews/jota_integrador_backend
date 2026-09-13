import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { AtualizarPrioridadeTicketUseCase } from './aplicacao/casos-de-uso/atualizar-prioridade-ticket.usecase';
import { AtualizarStatusTicketUseCase } from './aplicacao/casos-de-uso/atualizar-status-ticket.usecase';
import { CriarTicketUseCase } from './aplicacao/casos-de-uso/criar-ticket.usecase';
import { EnviarMensagemUseCase } from './aplicacao/casos-de-uso/enviar-mensagem.usecase';
import { ExcluirTicketUseCase } from './aplicacao/casos-de-uso/excluir-ticket.usecase';
import { ListarMensagensUseCase } from './aplicacao/casos-de-uso/listar-mensagens.usecase';
import { ListarTicketsUseCase } from './aplicacao/casos-de-uso/listar-tickets.usecase';
import { ObterResumoSuporteUseCase } from './aplicacao/casos-de-uso/obter-resumo-suporte.usecase';
import { ObterTicketUseCase } from './aplicacao/casos-de-uso/obter-ticket.usecase';
import { ObterUrlAnexoMensagemUseCase } from './aplicacao/casos-de-uso/obter-url-anexo-mensagem.usecase';
import { MENSAGENS_REPOSITORIO } from './aplicacao/portas/mensagens-repositorio.port';
import { TICKETS_REPOSITORIO } from './aplicacao/portas/tickets-repositorio.port';
import { SuporteController } from './apresentacao/suporte.controller';
import { MensagensRepositorioSupabase } from './infraestrutura/mensagens.repositorio.supabase';
import { StorageSuporteService } from './infraestrutura/storage-suporte.service';
import { TicketsRepositorioSupabase } from './infraestrutura/tickets.repositorio.supabase';

@Module({
  imports: [EmpresasModule], // EMPRESAS_REPOSITORIO -- resolver contador_id ao criar ticket de empresa
  controllers: [SuporteController],
  providers: [
    { provide: TICKETS_REPOSITORIO, useClass: TicketsRepositorioSupabase },
    { provide: MENSAGENS_REPOSITORIO, useClass: MensagensRepositorioSupabase },
    StorageSuporteService,
    CriarTicketUseCase,
    ListarTicketsUseCase,
    ObterTicketUseCase,
    AtualizarStatusTicketUseCase,
    AtualizarPrioridadeTicketUseCase,
    ExcluirTicketUseCase,
    ListarMensagensUseCase,
    EnviarMensagemUseCase,
    ObterUrlAnexoMensagemUseCase,
    ObterResumoSuporteUseCase,
  ],
})
export class SuporteModule {}
