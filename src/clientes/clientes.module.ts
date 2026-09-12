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
  exports: [CLIENTES_REPOSITORIO],
})
export class ClientesModule {}
