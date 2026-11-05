import { Module } from '@nestjs/common';
import { BancosModule } from '../bancos/bancos.module';
import { ClientesModule } from '../clientes/clientes.module';
import { ContasAReceberModule } from '../contas-a-receber/contas-a-receber.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { PagbankModule } from '../common/pagbank/pagbank.module';
import { GerarLinkPagamentoParcelaUseCase } from './aplicacao/casos-de-uso/gerar-link-pagamento-parcela.usecase';
import { ProcessarWebhookPagbankParcelaUseCase } from './aplicacao/casos-de-uso/processar-webhook-pagbank-parcela.usecase';
import { LINKS_PAGAMENTO_PARCELA_REPOSITORIO } from './aplicacao/portas/links-pagamento-parcela-repositorio.port';
import { LinkPagamentoParcelaController } from './apresentacao/link-pagamento-parcela.controller';
import { WebhookPagbankParcelaController } from './apresentacao/webhook-pagbank-parcela.controller';
import { LinksPagamentoParcelaRepositorioSupabase } from './infraestrutura/links-pagamento-parcela.repositorio.supabase';

@Module({
  // ContasAReceberModule -- CONTAS_RECEBER_REPOSITORIO (ler parcela/conta) +
  // RegistrarRecebimentoUseCase (fechar a parcela quando o webhook confirmar).
  // EmpresasModule -- pagbankAccountId/bancoPagbankId do credor. ClientesModule --
  // documento/email/telefone de quem paga. BancosModule -- resolver banco_pagbank_id
  // pra conta_contabil_id real. PagbankModule -- PagbankConfigService (split/webhook/client).
  imports: [ContasAReceberModule, EmpresasModule, ClientesModule, BancosModule, PagbankModule],
  controllers: [LinkPagamentoParcelaController, WebhookPagbankParcelaController],
  providers: [
    { provide: LINKS_PAGAMENTO_PARCELA_REPOSITORIO, useClass: LinksPagamentoParcelaRepositorioSupabase },
    GerarLinkPagamentoParcelaUseCase,
    ProcessarWebhookPagbankParcelaUseCase,
  ],
})
export class PagamentosParcelaModule {}
