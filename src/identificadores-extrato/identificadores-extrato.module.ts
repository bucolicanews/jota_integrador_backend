import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { AtualizarIdentificadorExtratoUseCase } from './aplicacao/casos-de-uso/atualizar-identificador-extrato.usecase';
import { CriarIdentificadorExtratoUseCase } from './aplicacao/casos-de-uso/criar-identificador-extrato.usecase';
import { ExcluirIdentificadorExtratoUseCase } from './aplicacao/casos-de-uso/excluir-identificador-extrato.usecase';
import { ListarIdentificadoresExtratoUseCase } from './aplicacao/casos-de-uso/listar-identificadores-extrato.usecase';
import { IDENTIFICADORES_EXTRATO_REPOSITORIO } from './aplicacao/portas/identificadores-extrato-repositorio.port';
import { IdentificadoresExtratoController } from './apresentacao/identificadores-extrato.controller';
import { IdentificadoresExtratoRepositorioSupabase } from './infraestrutura/identificadores-extrato.repositorio.supabase';

@Module({
  imports: [EmpresasModule],
  controllers: [IdentificadoresExtratoController],
  providers: [
    { provide: IDENTIFICADORES_EXTRATO_REPOSITORIO, useClass: IdentificadoresExtratoRepositorioSupabase },
    CriarIdentificadorExtratoUseCase,
    ListarIdentificadoresExtratoUseCase,
    AtualizarIdentificadorExtratoUseCase,
    ExcluirIdentificadorExtratoUseCase,
  ],
})
export class IdentificadoresExtratoModule {}
