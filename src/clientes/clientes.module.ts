import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { AlternarAtivoClienteUseCase } from './aplicacao/casos-de-uso/alternar-ativo-cliente.usecase';
import { AtualizarClienteUseCase } from './aplicacao/casos-de-uso/atualizar-cliente.usecase';
import { CriarClienteUseCase } from './aplicacao/casos-de-uso/criar-cliente.usecase';
import { ListarClientesUseCase } from './aplicacao/casos-de-uso/listar-clientes.usecase';
import { CLIENTES_REPOSITORIO } from './aplicacao/portas/clientes-repositorio.port';
import { ClientesController } from './apresentacao/clientes.controller';
import { ClientesRepositorioSupabase } from './infraestrutura/clientes.repositorio.supabase';

@Module({
  imports: [EmpresasModule],
  controllers: [ClientesController],
  providers: [
    { provide: CLIENTES_REPOSITORIO, useClass: ClientesRepositorioSupabase },
    CriarClienteUseCase,
    ListarClientesUseCase,
    AtualizarClienteUseCase,
    AlternarAtivoClienteUseCase,
  ],
  // CriarClienteUseCase exportado pro módulo de Notas Fiscais reaproveitar o dedupe/
  // validação de documento em vez de duplicar (mesmo motivo de CriarFornecedorUseCase
  // em fornecedores.module.ts).
  exports: [CLIENTES_REPOSITORIO, CriarClienteUseCase],
})
export class ClientesModule {}
