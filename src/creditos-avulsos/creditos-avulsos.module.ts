import { Module } from '@nestjs/common';
import { ContadoresModule } from '../contadores/contadores.module';
import { CreditosModule } from '../creditos/creditos.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { PagbankModule } from '../common/pagbank/pagbank.module';
import { PlanosRevendaCreditosAvulsosModule } from '../planos-revenda-creditos-avulsos/planos-revenda-creditos-avulsos.module';
import { AtualizarPacoteCreditoAvulsoUseCase } from './aplicacao/casos-de-uso/atualizar-pacote-credito-avulso.usecase';
import { CriarPacoteCreditoAvulsoUseCase } from './aplicacao/casos-de-uso/criar-pacote-credito-avulso.usecase';
import { DefinirValorPorCreditoUseCase } from './aplicacao/casos-de-uso/definir-valor-por-credito.usecase';
import { IniciarCompraCreditoAvulsoUseCase } from './aplicacao/casos-de-uso/iniciar-compra-credito-avulso.usecase';
import { ListarPacotesCreditosAvulsosUseCase } from './aplicacao/casos-de-uso/listar-pacotes-creditos-avulsos.usecase';
import { ListarPacotesRevendaDisponiveisUseCase } from './aplicacao/casos-de-uso/listar-pacotes-revenda-disponiveis.usecase';
import { ObterConfiguracaoCreditosAvulsosUseCase } from './aplicacao/casos-de-uso/obter-configuracao-creditos-avulsos.usecase';
import { ProcessarWebhookCreditoAvulsoUseCase } from './aplicacao/casos-de-uso/processar-webhook-credito-avulso.usecase';
import { CONFIGURACAO_CREDITOS_AVULSOS_REPOSITORIO } from './aplicacao/portas/configuracao-creditos-avulsos-repositorio.port';
import { PACOTES_CREDITOS_AVULSOS_REPOSITORIO } from './aplicacao/portas/pacotes-creditos-avulsos-repositorio.port';
import { PAGAMENTOS_CREDITOS_AVULSOS_REPOSITORIO } from './aplicacao/portas/pagamentos-creditos-avulsos-repositorio.port';
import { CreditosAvulsosController } from './apresentacao/creditos-avulsos.controller';
import { PacotesCreditosAvulsosController } from './apresentacao/pacotes-creditos-avulsos.controller';
import { WebhookPagbankCreditosAvulsosController } from './apresentacao/webhook-pagbank-creditos-avulsos.controller';
import { ConfiguracaoCreditosAvulsosRepositorioSupabase } from './infraestrutura/configuracao-creditos-avulsos.repositorio.supabase';
import { PacotesCreditosAvulsosRepositorioSupabase } from './infraestrutura/pacotes-creditos-avulsos.repositorio.supabase';
import { PagamentosCreditosAvulsosRepositorioSupabase } from './infraestrutura/pagamentos-creditos-avulsos.repositorio.supabase';

// Top-up pontual de créditos. Dois caminhos: (1) pacote direto da plataforma -- a própria
// empresa compra pra si, ou o contador em nome dela, SEM split (100% Jota); (2) pacote de
// revenda do CONTADOR (plano_revenda_creditos_avulsos) -- só a empresa compra (produto
// daquele contador específico), COM split (contador + plataforma), mesmo mecanismo de
// licencas-modulo/iniciar-pagamento-ativacao-licenca.usecase.ts.
@Module({
  imports: [EmpresasModule, CreditosModule, PagbankModule, ContadoresModule, PlanosRevendaCreditosAvulsosModule],
  controllers: [PacotesCreditosAvulsosController, CreditosAvulsosController, WebhookPagbankCreditosAvulsosController],
  providers: [
    { provide: PACOTES_CREDITOS_AVULSOS_REPOSITORIO, useClass: PacotesCreditosAvulsosRepositorioSupabase },
    { provide: PAGAMENTOS_CREDITOS_AVULSOS_REPOSITORIO, useClass: PagamentosCreditosAvulsosRepositorioSupabase },
    { provide: CONFIGURACAO_CREDITOS_AVULSOS_REPOSITORIO, useClass: ConfiguracaoCreditosAvulsosRepositorioSupabase },
    ListarPacotesCreditosAvulsosUseCase,
    CriarPacoteCreditoAvulsoUseCase,
    AtualizarPacoteCreditoAvulsoUseCase,
    ObterConfiguracaoCreditosAvulsosUseCase,
    DefinirValorPorCreditoUseCase,
    IniciarCompraCreditoAvulsoUseCase,
    ListarPacotesRevendaDisponiveisUseCase,
    ProcessarWebhookCreditoAvulsoUseCase,
  ],
})
export class CreditosAvulsosModule {}
