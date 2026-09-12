import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { LancamentosContabeisModule } from '../lancamentos-contabeis/lancamentos-contabeis.module';
import { PlanoDeContasModule } from '../plano-de-contas/plano-de-contas.module';
import { CancelarContaReceberUseCase } from './aplicacao/casos-de-uso/cancelar-conta-receber.usecase';
import { CriarContaReceberUseCase } from './aplicacao/casos-de-uso/criar-conta-receber.usecase';
import { EstornarRecebimentoUseCase } from './aplicacao/casos-de-uso/estornar-recebimento.usecase';
import { ListarContasReceberUseCase } from './aplicacao/casos-de-uso/listar-contas-receber.usecase';
import { ListarRecebimentosParcelaUseCase } from './aplicacao/casos-de-uso/listar-recebimentos-parcela.usecase';
import { ObterContaReceberUseCase } from './aplicacao/casos-de-uso/obter-conta-receber.usecase';
import { RegistrarRecebimentoUseCase } from './aplicacao/casos-de-uso/registrar-recebimento.usecase';
import { CONTAS_RECEBER_REPOSITORIO } from './aplicacao/portas/contas-receber-repositorio.port';
import { ContasAReceberController } from './apresentacao/contas-a-receber.controller';
import { ContasReceberRepositorioSupabase } from './infraestrutura/contas-receber.repositorio.supabase';

@Module({
  imports: [EmpresasModule, PlanoDeContasModule, LancamentosContabeisModule, ClientesModule],
  controllers: [ContasAReceberController],
  providers: [
    { provide: CONTAS_RECEBER_REPOSITORIO, useClass: ContasReceberRepositorioSupabase },
    CriarContaReceberUseCase,
    ListarContasReceberUseCase,
    ObterContaReceberUseCase,
    CancelarContaReceberUseCase,
    RegistrarRecebimentoUseCase,
    EstornarRecebimentoUseCase,
    ListarRecebimentosParcelaUseCase,
  ],
  // CriarContaReceberUseCase/CancelarContaReceberUseCase exportados pro módulo de
  // Contratos (Fase 6) reaproveitar 100% a lógica de partida dobrada + parcelamento em
  // vez de duplicar -- contrato com valor financeiro cria uma conta a receber real;
  // aditivo que muda valor/parcelamento cancela a antiga e cria uma nova.
  exports: [CONTAS_RECEBER_REPOSITORIO, RegistrarRecebimentoUseCase, CriarContaReceberUseCase, CancelarContaReceberUseCase],
})
export class ContasAReceberModule {}
