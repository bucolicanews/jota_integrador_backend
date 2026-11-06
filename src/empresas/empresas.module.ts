import { forwardRef, Module } from '@nestjs/common';
import { PagbankModule } from '../common/pagbank/pagbank.module';
import { PlanoDeContasModule } from '../plano-de-contas/plano-de-contas.module';
import { AtualizarEmpresaUseCase } from './aplicacao/casos-de-uso/atualizar-empresa.usecase';
import { AtualizarModoAcessoSerproUseCase } from './aplicacao/casos-de-uso/atualizar-modo-acesso-serpro.usecase';
import { AtualizarPagbankContaEmpresaUseCase } from './aplicacao/casos-de-uso/atualizar-pagbank-conta-empresa.usecase';
import { BloquearEmpresaUseCase } from './aplicacao/casos-de-uso/bloquear-empresa.usecase';
import { CorrigirCnpjEmpresaUseCase } from './aplicacao/casos-de-uso/corrigir-cnpj-empresa.usecase';
import { CriarEmpresaUseCase } from './aplicacao/casos-de-uso/criar-empresa.usecase';
import { TransferirCarteiraEmpresaUseCase } from './aplicacao/casos-de-uso/transferir-carteira-empresa.usecase';
import { DesbloquearEmpresaUseCase } from './aplicacao/casos-de-uso/desbloquear-empresa.usecase';
import { ListarEmpresasUseCase } from './aplicacao/casos-de-uso/listar-empresas.usecase';
import { ObterEmpresaInternaUseCase } from './aplicacao/casos-de-uso/obter-empresa-interna.usecase';
import { ObterEmpresaUseCase } from './aplicacao/casos-de-uso/obter-empresa.usecase';
import { EMPRESAS_REPOSITORIO } from './aplicacao/portas/empresas-repositorio.port';
import { EmpresasController } from './apresentacao/empresas.controller';
import { PagbankContaEmpresaController } from './apresentacao/pagbank-conta-empresa.controller';
import { EmpresasRepositorioSupabase } from './infraestrutura/empresas.repositorio.supabase';

@Module({
  imports: [PagbankModule, forwardRef(() => PlanoDeContasModule)],
  controllers: [EmpresasController, PagbankContaEmpresaController],
  providers: [
    { provide: EMPRESAS_REPOSITORIO, useClass: EmpresasRepositorioSupabase },
    CriarEmpresaUseCase,
    ListarEmpresasUseCase,
    ObterEmpresaUseCase,
    ObterEmpresaInternaUseCase,
    AtualizarEmpresaUseCase,
    AtualizarModoAcessoSerproUseCase,
    AtualizarPagbankContaEmpresaUseCase,
    BloquearEmpresaUseCase,
    DesbloquearEmpresaUseCase,
    CorrigirCnpjEmpresaUseCase,
    TransferirCarteiraEmpresaUseCase,
  ],
  // Exportado pra AuthModule resolver a checagem de posse ao criar EMPRESARIO_DONO/
  // OPERADOR_EMPRESA pra uma empresa da carteira do contador (limitação v1 documentada
  // em AuthController -- ver commit do módulo de autenticação). ListarEmpresasUseCase
  // também exportado -- ListarUsuariosUseCase reusa ele pra resolver a carteira do contador.
  // CriarEmpresaUseCase exportado -- CadastroEmpresaModule reusa ele como primeiro passo
  // do orquestrador (empresa+plano+login), sem duplicar a lógica de criação aqui.
  exports: [EMPRESAS_REPOSITORIO, ListarEmpresasUseCase, CriarEmpresaUseCase],
})
export class EmpresasModule {}
