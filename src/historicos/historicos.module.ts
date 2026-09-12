import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { AtualizarHistoricoUseCase } from './aplicacao/casos-de-uso/atualizar-historico.usecase';
import { CriarHistoricoUseCase } from './aplicacao/casos-de-uso/criar-historico.usecase';
import { ExcluirHistoricoUseCase } from './aplicacao/casos-de-uso/excluir-historico.usecase';
import { ListarHistoricosUseCase } from './aplicacao/casos-de-uso/listar-historicos.usecase';
import { HISTORICOS_REPOSITORIO } from './aplicacao/portas/historicos-repositorio.port';
import { HistoricosController } from './apresentacao/historicos.controller';
import { HistoricosRepositorioSupabase } from './infraestrutura/historicos.repositorio.supabase';

@Module({
  imports: [EmpresasModule],
  controllers: [HistoricosController],
  providers: [
    { provide: HISTORICOS_REPOSITORIO, useClass: HistoricosRepositorioSupabase },
    CriarHistoricoUseCase,
    ListarHistoricosUseCase,
    AtualizarHistoricoUseCase,
    ExcluirHistoricoUseCase,
  ],
  exports: [HISTORICOS_REPOSITORIO],
})
export class HistoricosModule {}
