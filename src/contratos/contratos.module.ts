import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { ContasAReceberModule } from '../contas-a-receber/contas-a-receber.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { PlanoDeContasModule } from '../plano-de-contas/plano-de-contas.module';
import { AssinarContratoPublicoUseCase } from './aplicacao/casos-de-uso/assinar-contrato-publico.usecase';
import { AtualizarContratoUseCase } from './aplicacao/casos-de-uso/atualizar-contrato.usecase';
import { AtualizarModeloContratoUseCase } from './aplicacao/casos-de-uso/atualizar-modelo-contrato.usecase';
import { BloquearContratoUseCase } from './aplicacao/casos-de-uso/bloquear-contrato.usecase';
import { CriarContratoUseCase } from './aplicacao/casos-de-uso/criar-contrato.usecase';
import { CriarModeloContratoUseCase } from './aplicacao/casos-de-uso/criar-modelo-contrato.usecase';
import { DesbloquearContratoUseCase } from './aplicacao/casos-de-uso/desbloquear-contrato.usecase';
import { ExcluirContratoUseCase } from './aplicacao/casos-de-uso/excluir-contrato.usecase';
import { ExcluirModeloContratoUseCase } from './aplicacao/casos-de-uso/excluir-modelo-contrato.usecase';
import { GerarLinkAssinaturaUseCase } from './aplicacao/casos-de-uso/gerar-link-assinatura.usecase';
import { ListarContratosUseCase } from './aplicacao/casos-de-uso/listar-contratos.usecase';
import { ListarModelosContratoUseCase } from './aplicacao/casos-de-uso/listar-modelos-contrato.usecase';
import { ObterCatalogoTagsUseCase } from './aplicacao/casos-de-uso/obter-catalogo-tags.usecase';
import { ObterConfiguracaoContratosUseCase } from './aplicacao/casos-de-uso/obter-configuracao-contratos.usecase';
import { ObterContratoPublicoUseCase } from './aplicacao/casos-de-uso/obter-contrato-publico.usecase';
import { ObterContratoUseCase } from './aplicacao/casos-de-uso/obter-contrato.usecase';
import { ObterModeloContratoUseCase } from './aplicacao/casos-de-uso/obter-modelo-contrato.usecase';
import { ObterUrlSelfieUseCase } from './aplicacao/casos-de-uso/obter-url-selfie.usecase';
import { PreVisualizarContratoUseCase } from './aplicacao/casos-de-uso/pre-visualizar-contrato.usecase';
import { RegistrarAditivoUseCase } from './aplicacao/casos-de-uso/registrar-aditivo.usecase';
import { SalvarConfiguracaoContratosUseCase } from './aplicacao/casos-de-uso/salvar-configuracao-contratos.usecase';
import { CONTRATOS_REPOSITORIO } from './aplicacao/portas/contratos-repositorio.port';
import { AssinaturaPublicaController } from './apresentacao/assinatura-publica.controller';
import { ContratosController } from './apresentacao/contratos.controller';
import { ContratosRepositorioSupabase } from './infraestrutura/contratos.repositorio.supabase';
import { StorageContratosService } from './infraestrutura/storage-contratos.service';

@Module({
  imports: [EmpresasModule, ClientesModule, ContasAReceberModule, PlanoDeContasModule],
  controllers: [ContratosController, AssinaturaPublicaController],
  providers: [
    { provide: CONTRATOS_REPOSITORIO, useClass: ContratosRepositorioSupabase },
    StorageContratosService,
    CriarModeloContratoUseCase,
    ListarModelosContratoUseCase,
    ObterModeloContratoUseCase,
    AtualizarModeloContratoUseCase,
    ExcluirModeloContratoUseCase,
    ObterCatalogoTagsUseCase,
    ObterConfiguracaoContratosUseCase,
    SalvarConfiguracaoContratosUseCase,
    PreVisualizarContratoUseCase,
    CriarContratoUseCase,
    ListarContratosUseCase,
    ObterContratoUseCase,
    AtualizarContratoUseCase,
    ExcluirContratoUseCase,
    BloquearContratoUseCase,
    DesbloquearContratoUseCase,
    RegistrarAditivoUseCase,
    GerarLinkAssinaturaUseCase,
    ObterContratoPublicoUseCase,
    AssinarContratoPublicoUseCase,
    ObterUrlSelfieUseCase,
  ],
  // CONTRATOS_REPOSITORIO exportado pra CriarContadorUseCase (ContadoresModule) seedar a
  // configuracao_contratos da empresa interna de todo contador novo. CriarContratoUseCase
  // exportado pra AtivarLicencaUseCase (LicencasModuloModule) gerar o contrato formal
  // contador->empresa na hora de ativar uma licença.
  exports: [CONTRATOS_REPOSITORIO, CriarContratoUseCase],
})
export class ContratosModule {}
