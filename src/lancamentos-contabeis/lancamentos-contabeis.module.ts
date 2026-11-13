import { forwardRef, Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { AtualizarLancamentoUseCase } from './aplicacao/casos-de-uso/atualizar-lancamento.usecase';
import { CriarLancamentoUseCase } from './aplicacao/casos-de-uso/criar-lancamento.usecase';
import { EstornarLancamentoUseCase } from './aplicacao/casos-de-uso/estornar-lancamento.usecase';
import { ListarLancamentosUseCase } from './aplicacao/casos-de-uso/listar-lancamentos.usecase';
import { ObterLancamentoUseCase } from './aplicacao/casos-de-uso/obter-lancamento.usecase';
import { ObterSaldoContaUseCase } from './aplicacao/casos-de-uso/obter-saldo-conta.usecase';
import { LANCAMENTOS_REPOSITORIO } from './aplicacao/portas/lancamentos-repositorio.port';
import { LancamentosController } from './apresentacao/lancamentos.controller';
import { LancamentosRepositorioSupabase } from './infraestrutura/lancamentos.repositorio.supabase';

@Module({
  imports: [forwardRef(() => EmpresasModule)],
  controllers: [LancamentosController],
  providers: [
    { provide: LANCAMENTOS_REPOSITORIO, useClass: LancamentosRepositorioSupabase },
    CriarLancamentoUseCase,
    ListarLancamentosUseCase,
    ObterLancamentoUseCase,
    EstornarLancamentoUseCase,
    AtualizarLancamentoUseCase,
    ObterSaldoContaUseCase,
  ],
  exports: [LANCAMENTOS_REPOSITORIO],
})
export class LancamentosContabeisModule {}
