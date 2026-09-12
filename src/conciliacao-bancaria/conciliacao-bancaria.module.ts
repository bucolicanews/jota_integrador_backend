import { Module } from '@nestjs/common';
import { ContasAPagarModule } from '../contas-a-pagar/contas-a-pagar.module';
import { ContasAReceberModule } from '../contas-a-receber/contas-a-receber.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { LancamentosContabeisModule } from '../lancamentos-contabeis/lancamentos-contabeis.module';
import { PlanoDeContasModule } from '../plano-de-contas/plano-de-contas.module';
import { AtualizarContaResultadoUseCase } from './aplicacao/casos-de-uso/atualizar-conta-resultado.usecase';
import { BuscarParcelasCandidatasUseCase } from './aplicacao/casos-de-uso/buscar-parcelas-candidatas.usecase';
import { ConfirmarTransacoesUseCase } from './aplicacao/casos-de-uso/confirmar-transacoes.usecase';
import { ExcluirConfiguracaoUseCase } from './aplicacao/casos-de-uso/excluir-configuracao.usecase';
import { IgnorarTransacaoUseCase } from './aplicacao/casos-de-uso/ignorar-transacao.usecase';
import { ListarConciliadasUseCase } from './aplicacao/casos-de-uso/listar-conciliadas.usecase';
import { ListarConfiguracoesUseCase } from './aplicacao/casos-de-uso/listar-configuracoes.usecase';
import { ListarHistoricoImportacoesUseCase } from './aplicacao/casos-de-uso/listar-historico-importacoes.usecase';
import { ListarPendentesUseCase } from './aplicacao/casos-de-uso/listar-pendentes.usecase';
import { ObterDetalheImportacaoUseCase } from './aplicacao/casos-de-uso/obter-detalhe-importacao.usecase';
import { PreVisualizarExtratoUseCase } from './aplicacao/casos-de-uso/pre-visualizar-extrato.usecase';
import { RegistrarExtratoManualUseCase } from './aplicacao/casos-de-uso/registrar-extrato-manual.usecase';
import { SalvarConfiguracaoUseCase } from './aplicacao/casos-de-uso/salvar-configuracao.usecase';
import { VincularTransacaoParcelaUseCase } from './aplicacao/casos-de-uso/vincular-transacao-parcela.usecase';
import { CONCILIACAO_REPOSITORIO } from './aplicacao/portas/conciliacao-repositorio.port';
import { ConciliacaoBancariaController } from './apresentacao/conciliacao-bancaria.controller';
import { ConciliacaoRepositorioSupabase } from './infraestrutura/conciliacao.repositorio.supabase';

@Module({
  imports: [EmpresasModule, PlanoDeContasModule, LancamentosContabeisModule, ContasAPagarModule, ContasAReceberModule],
  controllers: [ConciliacaoBancariaController],
  providers: [
    { provide: CONCILIACAO_REPOSITORIO, useClass: ConciliacaoRepositorioSupabase },
    SalvarConfiguracaoUseCase,
    ListarConfiguracoesUseCase,
    ExcluirConfiguracaoUseCase,
    PreVisualizarExtratoUseCase,
    ConfirmarTransacoesUseCase,
    ListarPendentesUseCase,
    ListarConciliadasUseCase,
    ListarHistoricoImportacoesUseCase,
    ObterDetalheImportacaoUseCase,
    AtualizarContaResultadoUseCase,
    IgnorarTransacaoUseCase,
    BuscarParcelasCandidatasUseCase,
    VincularTransacaoParcelaUseCase,
    RegistrarExtratoManualUseCase,
  ],
})
export class ConciliacaoBancariaModule {}
