import { Module } from '@nestjs/common';
import { CreditosModule } from '../creditos/creditos.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { SerproModule } from '../serpro/serpro.module';
import { AtualizarStatusProcuracaoUseCase } from './aplicacao/casos-de-uso/atualizar-status-procuracao.usecase';
import { ObterProcuracaoUseCase } from './aplicacao/casos-de-uso/obter-procuracao.usecase';
import { SincronizarProcuracaoUseCase } from './aplicacao/casos-de-uso/sincronizar-procuracao.usecase';
import { PROCURACOES_REPOSITORIO } from './aplicacao/portas/procuracoes-repositorio.port';
import { ProcuracoesController } from './apresentacao/procuracoes.controller';
import { ProcuracaoSincronizacaoCron } from './infraestrutura/procuracao-sincronizacao.cron';
import { ProcuracoesRepositorioSupabase } from './infraestrutura/procuracoes.repositorio.supabase';

@Module({
  // EmpresasModule pra checagem de posse. SerproModule -- gateway/consultas/acesso.
  // CreditosModule -- débito/estorno da sincronização automática (SincronizarProcuracaoUseCase).
  imports: [EmpresasModule, SerproModule, CreditosModule],
  controllers: [ProcuracoesController],
  providers: [
    { provide: PROCURACOES_REPOSITORIO, useClass: ProcuracoesRepositorioSupabase },
    ObterProcuracaoUseCase,
    AtualizarStatusProcuracaoUseCase,
    SincronizarProcuracaoUseCase,
    ProcuracaoSincronizacaoCron,
  ],
})
export class ProcuracoesModule {}
