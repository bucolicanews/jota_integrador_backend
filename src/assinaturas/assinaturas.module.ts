import { Module } from '@nestjs/common';
import { ContadoresModule } from '../contadores/contadores.module';
import { ContratosModule } from '../contratos/contratos.module';
import { CreditosModule } from '../creditos/creditos.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { PagbankModule } from '../common/pagbank/pagbank.module';
import { PlanosModule } from '../planos/planos.module';
import { PlanosRevendaCreditosModule } from '../planos-revenda-creditos/planos-revenda-creditos.module';
import { AtivarAssinaturaManualUseCase } from './aplicacao/casos-de-uso/ativar-assinatura-manual.usecase';
import { BloquearAssinaturaUseCase } from './aplicacao/casos-de-uso/bloquear-assinatura.usecase';
import { CancelarAssinaturaCreditoUseCase } from './aplicacao/casos-de-uso/cancelar-assinatura-credito.usecase';
import { IniciarPagamentoAssinaturaCreditosUseCase } from './aplicacao/casos-de-uso/iniciar-pagamento-assinatura-creditos.usecase';
import { ObterAssinaturaAtualUseCase } from './aplicacao/casos-de-uso/obter-assinatura-atual.usecase';
import { ProcessarWebhookPagbankCreditosUseCase } from './aplicacao/casos-de-uso/processar-webhook-pagbank-creditos.usecase';
import { ASSINATURAS_REPOSITORIO } from './aplicacao/portas/assinaturas-repositorio.port';
import { PAGAMENTOS_ASSINATURA_CREDITOS_REPOSITORIO } from './aplicacao/portas/pagamentos-assinatura-creditos-repositorio.port';
import { AssinaturasController } from './apresentacao/assinaturas.controller';
import { WebhookPagbankCreditosController } from './apresentacao/webhook-pagbank-creditos.controller';
import { AssinaturasRepositorioSupabase } from './infraestrutura/assinaturas.repositorio.supabase';
import { PagamentosAssinaturaCreditosRepositorioSupabase } from './infraestrutura/pagamentos-assinatura-creditos.repositorio.supabase';

@Module({
  // PlanosModule -- catálogo de planos de créditos. PlanosRevendaCreditosModule -- plano
  // de revenda do contador. ContadoresModule/EmpresasModule -- posse/pagbankAccountId.
  // ContratosModule -- registro contábil interno ao confirmar pagamento. CreditosModule
  // -- creditar operações na ativação manual/renovação paga. PagbankModule -- split.
  imports: [ContadoresModule, EmpresasModule, PlanosModule, PlanosRevendaCreditosModule, ContratosModule, CreditosModule, PagbankModule],
  controllers: [AssinaturasController, WebhookPagbankCreditosController],
  providers: [
    { provide: ASSINATURAS_REPOSITORIO, useClass: AssinaturasRepositorioSupabase },
    { provide: PAGAMENTOS_ASSINATURA_CREDITOS_REPOSITORIO, useClass: PagamentosAssinaturaCreditosRepositorioSupabase },
    ObterAssinaturaAtualUseCase,
    AtivarAssinaturaManualUseCase,
    BloquearAssinaturaUseCase,
    CancelarAssinaturaCreditoUseCase,
    IniciarPagamentoAssinaturaCreditosUseCase,
    ProcessarWebhookPagbankCreditosUseCase,
  ],
  // ASSINATURAS_REPOSITORIO exportado -- serpro/ e caixa-postal/ consultam
  // buscarAtivaPorEmpresa antes de debitar crédito (gate de acesso por empresa).
  exports: [ASSINATURAS_REPOSITORIO],
})
export class AssinaturasModule {}
