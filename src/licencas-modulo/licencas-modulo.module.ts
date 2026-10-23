import { Module } from '@nestjs/common';
import { PagbankModule } from '../common/pagbank/pagbank.module';
import { ContadoresModule } from '../contadores/contadores.module';
import { ContratosModule } from '../contratos/contratos.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { PacotesModulosModule } from '../pacotes-modulos/pacotes-modulos.module';
import { PlanosRevendaPacoteModule } from '../planos-revenda-pacote/planos-revenda-pacote.module';
import { AtivarLicencaUseCase } from './aplicacao/casos-de-uso/ativar-licenca.usecase';
import { DesativarLicencaUseCase } from './aplicacao/casos-de-uso/desativar-licenca.usecase';
import { IniciarCheckoutLicencaUseCase } from './aplicacao/casos-de-uso/iniciar-checkout-licenca.usecase';
import { IniciarPagamentoAtivacaoLicencaUseCase } from './aplicacao/casos-de-uso/iniciar-pagamento-ativacao-licenca.usecase';
import { ListarLicencasDisponiveisParaEmpresaUseCase } from './aplicacao/casos-de-uso/listar-licencas-disponiveis-para-empresa.usecase';
import { ListarLicencasUseCase } from './aplicacao/casos-de-uso/listar-licencas.usecase';
import { ListarPendenciasPagamentoAtivacaoUseCase } from './aplicacao/casos-de-uso/listar-pendencias-pagamento-ativacao.usecase';
import { ProcessarWebhookPagbankLicencaUseCase } from './aplicacao/casos-de-uso/processar-webhook-pagbank-licenca.usecase';
import { ProcessarWebhookStripeLicencaUseCase } from './aplicacao/casos-de-uso/processar-webhook-stripe-licenca.usecase';
import { LICENCAS_MODULO_REPOSITORIO } from './aplicacao/portas/licencas-modulo-repositorio.port';
import { PAGAMENTOS_ATIVACAO_LICENCA_REPOSITORIO } from './aplicacao/portas/pagamentos-ativacao-licenca-repositorio.port';
import { LicencasModuloEmpresaController } from './apresentacao/licencas-modulo-empresa.controller';
import { LicencasModuloController } from './apresentacao/licencas-modulo.controller';
import { PendenciasPagamentoController } from './apresentacao/pendencias-pagamento.controller';
import { WebhookLicencasController } from './apresentacao/webhook-licencas.controller';
import { WebhookPagbankLicencasController } from './apresentacao/webhook-pagbank-licencas.controller';
import { LicencasModuloRepositorioSupabase } from './infraestrutura/licencas-modulo.repositorio.supabase';
import { PagamentosAtivacaoLicencaRepositorioSupabase } from './infraestrutura/pagamentos-ativacao-licenca.repositorio.supabase';
import { StripeLicencasService } from './infraestrutura/stripe-licencas.service';

@Module({
  imports: [ContadoresModule, EmpresasModule, PacotesModulosModule, ContratosModule, PlanosRevendaPacoteModule, PagbankModule],
  controllers: [LicencasModuloController, LicencasModuloEmpresaController, WebhookLicencasController, WebhookPagbankLicencasController, PendenciasPagamentoController],
  providers: [
    { provide: LICENCAS_MODULO_REPOSITORIO, useClass: LicencasModuloRepositorioSupabase },
    { provide: PAGAMENTOS_ATIVACAO_LICENCA_REPOSITORIO, useClass: PagamentosAtivacaoLicencaRepositorioSupabase },
    StripeLicencasService,
    IniciarCheckoutLicencaUseCase,
    ProcessarWebhookStripeLicencaUseCase,
    IniciarPagamentoAtivacaoLicencaUseCase,
    ProcessarWebhookPagbankLicencaUseCase,
    ListarLicencasUseCase,
    ListarLicencasDisponiveisParaEmpresaUseCase,
    ListarPendenciasPagamentoAtivacaoUseCase,
    AtivarLicencaUseCase,
    DesativarLicencaUseCase,
  ],
  exports: [LICENCAS_MODULO_REPOSITORIO],
})
export class LicencasModuloModule {}
