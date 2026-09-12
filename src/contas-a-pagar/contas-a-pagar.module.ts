import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { FornecedoresModule } from '../fornecedores/fornecedores.module';
import { LancamentosContabeisModule } from '../lancamentos-contabeis/lancamentos-contabeis.module';
import { PlanoDeContasModule } from '../plano-de-contas/plano-de-contas.module';
import { CancelarContaPagarUseCase } from './aplicacao/casos-de-uso/cancelar-conta-pagar.usecase';
import { CriarContaPagarUseCase } from './aplicacao/casos-de-uso/criar-conta-pagar.usecase';
import { EstornarPagamentoUseCase } from './aplicacao/casos-de-uso/estornar-pagamento.usecase';
import { ListarContasPagarUseCase } from './aplicacao/casos-de-uso/listar-contas-pagar.usecase';
import { ListarPagamentosParcelaUseCase } from './aplicacao/casos-de-uso/listar-pagamentos-parcela.usecase';
import { ObterContaPagarUseCase } from './aplicacao/casos-de-uso/obter-conta-pagar.usecase';
import { RegistrarPagamentoUseCase } from './aplicacao/casos-de-uso/registrar-pagamento.usecase';
import { CONTAS_PAGAR_REPOSITORIO } from './aplicacao/portas/contas-pagar-repositorio.port';
import { ContasAPagarController } from './apresentacao/contas-a-pagar.controller';
import { ContasPagarRepositorioSupabase } from './infraestrutura/contas-pagar.repositorio.supabase';

@Module({
  imports: [EmpresasModule, PlanoDeContasModule, LancamentosContabeisModule, FornecedoresModule],
  controllers: [ContasAPagarController],
  providers: [
    { provide: CONTAS_PAGAR_REPOSITORIO, useClass: ContasPagarRepositorioSupabase },
    CriarContaPagarUseCase,
    ListarContasPagarUseCase,
    ObterContaPagarUseCase,
    CancelarContaPagarUseCase,
    RegistrarPagamentoUseCase,
    EstornarPagamentoUseCase,
    ListarPagamentosParcelaUseCase,
  ],
  exports: [CONTAS_PAGAR_REPOSITORIO, RegistrarPagamentoUseCase],
})
export class ContasAPagarModule {}
