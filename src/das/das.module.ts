import { forwardRef, Module } from '@nestjs/common';
import { BancosModule } from '../bancos/bancos.module';
import { ContasAPagarModule } from '../contas-a-pagar/contas-a-pagar.module';
import { CreditosModule } from '../creditos/creditos.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { LancamentosContabeisModule } from '../lancamentos-contabeis/lancamentos-contabeis.module';
import { PlanoDeContasModule } from '../plano-de-contas/plano-de-contas.module';
import { PlanosModule } from '../planos/planos.module';
import { SerproModule } from '../serpro/serpro.module';
import { GerarSegundaViaDasUseCase } from './aplicacao/casos-de-uso/gerar-segunda-via-das.usecase';
import { ListarDasUseCase } from './aplicacao/casos-de-uso/listar-das.usecase';
import { ObterUrlPdfDasUseCase } from './aplicacao/casos-de-uso/obter-url-pdf-das.usecase';
import { EstimarSincronizacaoDasUseCase } from './aplicacao/casos-de-uso/estimar-sincronizacao-das.usecase';
import { SincronizarDasEmpresaUseCase } from './aplicacao/casos-de-uso/sincronizar-das-empresa.usecase';
import { SincronizarDasTodasEmpresasUseCase } from './aplicacao/casos-de-uso/sincronizar-das-todas-empresas.usecase';
import { VerificarCotaIncluidaUseCase } from './aplicacao/casos-de-uso/verificar-cota-incluida.usecase';
import { BuscarConfiguracaoLancamentosDasUseCase } from './aplicacao/casos-de-uso/buscar-configuracao-lancamentos-das.usecase';
import { SalvarConfiguracaoLancamentosDasUseCase } from './aplicacao/casos-de-uso/salvar-configuracao-lancamentos-das.usecase';
import { ListarDasPendentesBaixaUseCase } from './aplicacao/casos-de-uso/listar-das-pendentes-baixa.usecase';
import { ResolverBaixaDasUseCase } from './aplicacao/casos-de-uso/resolver-baixa-das.usecase';
import { GerarProvisaoDasUseCase } from './aplicacao/casos-de-uso/gerar-provisao-das.usecase';
import { GerarProvisaoManualDasUseCase } from './aplicacao/casos-de-uso/gerar-provisao-manual-das.usecase';
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
  // LancamentosContabeisModule/PlanoDeContasModule/BancosModule -- baixa automática do DAS
  // (lançamento direto, validação de conta, resolução de caixa/banco). ContasAPagarModule
  // -- provisão automática do DAS, que agora é uma conta a pagar de verdade (ver
  // GerarProvisaoDasUseCase), não mais um lançamento direto.
  imports: [
    EmpresasModule,
    CreditosModule,
    SerproModule,
    PlanosModule,
    forwardRef(() => LancamentosContabeisModule),
    forwardRef(() => PlanoDeContasModule),
    forwardRef(() => BancosModule),
    forwardRef(() => ContasAPagarModule),
  ],
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
    BuscarConfiguracaoLancamentosDasUseCase,
    SalvarConfiguracaoLancamentosDasUseCase,
    ListarDasPendentesBaixaUseCase,
    ResolverBaixaDasUseCase,
    GerarProvisaoDasUseCase,
    GerarProvisaoManualDasUseCase,
    DasSincronizacaoCron,
  ],
})
export class DasModule {}
