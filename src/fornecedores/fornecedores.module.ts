import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { AlternarAtivoFornecedorUseCase } from './aplicacao/casos-de-uso/alternar-ativo-fornecedor.usecase';
import { AtualizarFornecedorUseCase } from './aplicacao/casos-de-uso/atualizar-fornecedor.usecase';
import { CriarFornecedorUseCase } from './aplicacao/casos-de-uso/criar-fornecedor.usecase';
import { ListarFornecedoresUseCase } from './aplicacao/casos-de-uso/listar-fornecedores.usecase';
import { FORNECEDORES_REPOSITORIO } from './aplicacao/portas/fornecedores-repositorio.port';
import { FornecedoresController } from './apresentacao/fornecedores.controller';
import { FornecedoresRepositorioSupabase } from './infraestrutura/fornecedores.repositorio.supabase';

@Module({
  imports: [EmpresasModule],
  controllers: [FornecedoresController],
  providers: [
    { provide: FORNECEDORES_REPOSITORIO, useClass: FornecedoresRepositorioSupabase },
    CriarFornecedorUseCase,
    ListarFornecedoresUseCase,
    AtualizarFornecedorUseCase,
    AlternarAtivoFornecedorUseCase,
  ],
  exports: [FORNECEDORES_REPOSITORIO],
})
export class FornecedoresModule {}
