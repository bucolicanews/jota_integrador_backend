import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { AtualizarDescricaoExtratoUseCase } from './aplicacao/casos-de-uso/atualizar-descricao-extrato.usecase';
import { CriarDescricaoExtratoUseCase } from './aplicacao/casos-de-uso/criar-descricao-extrato.usecase';
import { ExcluirDescricaoExtratoUseCase } from './aplicacao/casos-de-uso/excluir-descricao-extrato.usecase';
import { ListarDescricoesExtratoUseCase } from './aplicacao/casos-de-uso/listar-descricoes-extrato.usecase';
import { DESCRICOES_EXTRATO_REPOSITORIO } from './aplicacao/portas/descricoes-extrato-repositorio.port';
import { DescricoesExtratoController } from './apresentacao/descricoes-extrato.controller';
import { DescricoesExtratoRepositorioSupabase } from './infraestrutura/descricoes-extrato.repositorio.supabase';

@Module({
  imports: [EmpresasModule],
  controllers: [DescricoesExtratoController],
  providers: [
    { provide: DESCRICOES_EXTRATO_REPOSITORIO, useClass: DescricoesExtratoRepositorioSupabase },
    CriarDescricaoExtratoUseCase,
    ListarDescricoesExtratoUseCase,
    AtualizarDescricaoExtratoUseCase,
    ExcluirDescricaoExtratoUseCase,
  ],
})
export class DescricoesExtratoModule {}
