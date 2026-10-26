import { Module } from '@nestjs/common';
import { CreditosModule } from '../creditos/creditos.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { PlanosModule } from '../planos/planos.module';
import { SerproModule } from '../serpro/serpro.module';
import { GerarSegundaViaDasUseCase } from './aplicacao/casos-de-uso/gerar-segunda-via-das.usecase';
import { ListarDasUseCase } from './aplicacao/casos-de-uso/listar-das.usecase';
import { ObterUrlPdfDasUseCase } from './aplicacao/casos-de-uso/obter-url-pdf-das.usecase';
import { EstimarSincronizacaoDasUseCase } from './aplicacao/casos-de-uso/estimar-sincronizacao-das.usecase';
import { SincronizarDasEmpresaUseCase } from './aplicacao/casos-de-uso/sincronizar-das-empresa.usecase';
import { SincronizarDasTodasEmpresasUseCase } from './aplicacao/casos-de-uso/sincronizar-das-todas-empresas.usecase';
import { VerificarCotaIncluidaUseCase } from './aplicacao/casos-de-uso/verificar-cota-incluida.usecase';
import { DAS_REPOSITORIO } from './aplicacao/portas/das-repositorio.port';
import { DasController } from './apresentacao/das.controller';
import { DasSincronizacaoCron } from './infraestrutura/das-sincronizacao.cron';
import { DasRepositorioSupabase } from './infraestrutura/das.repositorio.supabase';
import { StorageDasService } from './infraestrutura/storage-das.service';

@Module({
  // EmpresasModule -- posse + listagem por regime (cron). CreditosModule -- débito/estorno.
  // SerproModule -- gateway HTTP, checagem de acesso e log de consultas, mesma infra de caixa-postal/CCMEI.
  // PlanosModule -- cota de consultas incluída no plano (VerificarCotaIncluidaUseCase mora
  // aqui, não em planos/, porque PlanosModule->SerproModule formaria ciclo via AssinaturasModule).
  imports: [EmpresasModule, CreditosModule, SerproModule, PlanosModule],
  controllers: [DasController],
  providers: [
    { provide: DAS_REPOSITORIO, useClass: DasRepositorioSupabase },
    StorageDasService,
    SincronizarDasEmpresaUseCase,
    EstimarSincronizacaoDasUseCase,
    SincronizarDasTodasEmpresasUseCase,
    VerificarCotaIncluidaUseCase,
    ListarDasUseCase,
    ObterUrlPdfDasUseCase,
    GerarSegundaViaDasUseCase,
    DasSincronizacaoCron,
  ],
})
export class DasModule {}
