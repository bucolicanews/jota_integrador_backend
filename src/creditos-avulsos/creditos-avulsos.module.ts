import { Module } from '@nestjs/common';
import { CreditosModule } from '../creditos/creditos.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { PagbankModule } from '../common/pagbank/pagbank.module';
import { AtualizarPacoteCreditoAvulsoUseCase } from './aplicacao/casos-de-uso/atualizar-pacote-credito-avulso.usecase';
import { CriarPacoteCreditoAvulsoUseCase } from './aplicacao/casos-de-uso/criar-pacote-credito-avulso.usecase';
import { IniciarCompraCreditoAvulsoUseCase } from './aplicacao/casos-de-uso/iniciar-compra-credito-avulso.usecase';
import { ListarPacotesCreditosAvulsosUseCase } from './aplicacao/casos-de-uso/listar-pacotes-creditos-avulsos.usecase';
import { ProcessarWebhookCreditoAvulsoUseCase } from './aplicacao/casos-de-uso/processar-webhook-credito-avulso.usecase';
import { PACOTES_CREDITOS_AVULSOS_REPOSITORIO } from './aplicacao/portas/pacotes-creditos-avulsos-repositorio.port';
import { PAGAMENTOS_CREDITOS_AVULSOS_REPOSITORIO } from './aplicacao/portas/pagamentos-creditos-avulsos-repositorio.port';
import { CreditosAvulsosController } from './apresentacao/creditos-avulsos.controller';
import { PacotesCreditosAvulsosController } from './apresentacao/pacotes-creditos-avulsos.controller';
import { WebhookPagbankCreditosAvulsosController } from './apresentacao/webhook-pagbank-creditos-avulsos.controller';
import { PacotesCreditosAvulsosRepositorioSupabase } from './infraestrutura/pacotes-creditos-avulsos.repositorio.supabase';
import { PagamentosCreditosAvulsosRepositorioSupabase } from './infraestrutura/pagamentos-creditos-avulsos.repositorio.supabase';

// Top-up pontual de créditos, comprável pela própria empresa (ou pelo contador em nome
// dela) direto da plataforma -- SEM split, dinheiro 100% Jota. Distinto de assinaturas/
// (que é recorrente, vinculada a um plano, e tem split com o contador).
@Module({
  imports: [EmpresasModule, CreditosModule, PagbankModule],
  controllers: [PacotesCreditosAvulsosController, CreditosAvulsosController, WebhookPagbankCreditosAvulsosController],
  providers: [
    { provide: PACOTES_CREDITOS_AVULSOS_REPOSITORIO, useClass: PacotesCreditosAvulsosRepositorioSupabase },
    { provide: PAGAMENTOS_CREDITOS_AVULSOS_REPOSITORIO, useClass: PagamentosCreditosAvulsosRepositorioSupabase },
    ListarPacotesCreditosAvulsosUseCase,
    CriarPacoteCreditoAvulsoUseCase,
    AtualizarPacoteCreditoAvulsoUseCase,
    IniciarCompraCreditoAvulsoUseCase,
    ProcessarWebhookCreditoAvulsoUseCase,
  ],
})
export class CreditosAvulsosModule {}
