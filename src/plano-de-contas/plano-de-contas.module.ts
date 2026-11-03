import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { AlterarAtivaContaContabilUseCase } from './aplicacao/casos-de-uso/alterar-ativa-conta-contabil.usecase';
import { AtualizarContaContabilUseCase } from './aplicacao/casos-de-uso/atualizar-conta-contabil.usecase';
import { CriarContaContabilUseCase } from './aplicacao/casos-de-uso/criar-conta-contabil.usecase';
import { ExportarPlanoContasUseCase } from './aplicacao/casos-de-uso/exportar-plano-contas.usecase';
import { ImportarPlanoContasUseCase } from './aplicacao/casos-de-uso/importar-plano-contas.usecase';
import { ListarContasContabeisUseCase } from './aplicacao/casos-de-uso/listar-contas-contabeis.usecase';
import { SemearPlanoContasUseCase } from './aplicacao/casos-de-uso/semear-plano-contas.usecase';
import { PLANO_CONTAS_REPOSITORIO } from './aplicacao/portas/plano-contas-repositorio.port';
import { PlanoContasModelosController } from './apresentacao/plano-contas-modelos.controller';
import { PlanoContasController } from './apresentacao/plano-contas.controller';
import { PlanoContasRepositorioSupabase } from './infraestrutura/plano-contas.repositorio.supabase';

@Module({
  imports: [EmpresasModule],
  controllers: [PlanoContasController, PlanoContasModelosController],
  providers: [
    { provide: PLANO_CONTAS_REPOSITORIO, useClass: PlanoContasRepositorioSupabase },
    CriarContaContabilUseCase,
    ListarContasContabeisUseCase,
    AtualizarContaContabilUseCase,
    AlterarAtivaContaContabilUseCase,
    ImportarPlanoContasUseCase,
    ExportarPlanoContasUseCase,
    SemearPlanoContasUseCase,
  ],
  exports: [PLANO_CONTAS_REPOSITORIO, SemearPlanoContasUseCase],
})
export class PlanoDeContasModule {}
