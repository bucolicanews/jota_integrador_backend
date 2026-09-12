import { Module } from '@nestjs/common';
import { ContadoresModule } from '../contadores/contadores.module';
import { ContratosModule } from '../contratos/contratos.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { PacotesModulosModule } from '../pacotes-modulos/pacotes-modulos.module';
import { AtivarLicencaUseCase } from './aplicacao/casos-de-uso/ativar-licenca.usecase';
import { DesativarLicencaUseCase } from './aplicacao/casos-de-uso/desativar-licenca.usecase';
import { IniciarCheckoutLicencaUseCase } from './aplicacao/casos-de-uso/iniciar-checkout-licenca.usecase';
import { ListarLicencasUseCase } from './aplicacao/casos-de-uso/listar-licencas.usecase';
import { ProcessarWebhookStripeLicencaUseCase } from './aplicacao/casos-de-uso/processar-webhook-stripe-licenca.usecase';
import { LICENCAS_MODULO_REPOSITORIO } from './aplicacao/portas/licencas-modulo-repositorio.port';
import { LicencasModuloController } from './apresentacao/licencas-modulo.controller';
import { WebhookLicencasController } from './apresentacao/webhook-licencas.controller';
import { LicencasModuloRepositorioSupabase } from './infraestrutura/licencas-modulo.repositorio.supabase';
import { StripeLicencasService } from './infraestrutura/stripe-licencas.service';

@Module({
  imports: [ContadoresModule, EmpresasModule, PacotesModulosModule, ContratosModule],
  controllers: [LicencasModuloController, WebhookLicencasController],
  providers: [
    { provide: LICENCAS_MODULO_REPOSITORIO, useClass: LicencasModuloRepositorioSupabase },
    StripeLicencasService,
    IniciarCheckoutLicencaUseCase,
    ProcessarWebhookStripeLicencaUseCase,
    ListarLicencasUseCase,
    AtivarLicencaUseCase,
    DesativarLicencaUseCase,
  ],
  exports: [LICENCAS_MODULO_REPOSITORIO],
})
export class LicencasModuloModule {}
