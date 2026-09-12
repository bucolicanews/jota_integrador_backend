import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { PlanoDeContasModule } from '../plano-de-contas/plano-de-contas.module';
import { ObterBalancoPatrimonialUseCase } from './aplicacao/casos-de-uso/obter-balanco-patrimonial.usecase';
import { ObterBalanceteUseCase } from './aplicacao/casos-de-uso/obter-balancete.usecase';
import { ObterDreUseCase } from './aplicacao/casos-de-uso/obter-dre.usecase';
import { ObterFluxoCaixaUseCase } from './aplicacao/casos-de-uso/obter-fluxo-caixa.usecase';
import { ObterRazaoUseCase } from './aplicacao/casos-de-uso/obter-razao.usecase';
import { RELATORIOS_REPOSITORIO } from './aplicacao/portas/relatorios-repositorio.port';
import { RelatoriosController } from './apresentacao/relatorios.controller';
import { RelatoriosRepositorioSupabase } from './infraestrutura/relatorios.repositorio.supabase';

@Module({
  imports: [EmpresasModule, PlanoDeContasModule],
  controllers: [RelatoriosController],
  providers: [
    { provide: RELATORIOS_REPOSITORIO, useClass: RelatoriosRepositorioSupabase },
    ObterBalanceteUseCase,
    ObterBalancoPatrimonialUseCase,
    ObterDreUseCase,
    ObterRazaoUseCase,
    ObterFluxoCaixaUseCase,
  ],
})
export class RelatoriosModule {}
