import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { LancamentosContabeisModule } from '../lancamentos-contabeis/lancamentos-contabeis.module';
import { PlanoDeContasModule } from '../plano-de-contas/plano-de-contas.module';
import { AlternarAtivoBancoUseCase } from './aplicacao/casos-de-uso/alternar-ativo-banco.usecase';
import { AtualizarBancoUseCase } from './aplicacao/casos-de-uso/atualizar-banco.usecase';
import { CriarBancoUseCase } from './aplicacao/casos-de-uso/criar-banco.usecase';
import { ListarBancosUseCase } from './aplicacao/casos-de-uso/listar-bancos.usecase';
import { BANCOS_REPOSITORIO } from './aplicacao/portas/bancos-repositorio.port';
import { BancosController } from './apresentacao/bancos.controller';
import { BancosRepositorioSupabase } from './infraestrutura/bancos.repositorio.supabase';

@Module({
  imports: [EmpresasModule, PlanoDeContasModule, LancamentosContabeisModule],
  controllers: [BancosController],
  providers: [
    { provide: BANCOS_REPOSITORIO, useClass: BancosRepositorioSupabase },
    CriarBancoUseCase,
    ListarBancosUseCase,
    AtualizarBancoUseCase,
    AlternarAtivoBancoUseCase,
  ],
})
export class BancosModule {}
