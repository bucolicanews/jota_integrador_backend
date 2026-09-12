import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { AtualizarProtocoloUseCase } from './aplicacao/casos-de-uso/atualizar-protocolo.usecase';
import { AvancarStatusProtocoloUseCase } from './aplicacao/casos-de-uso/avancar-status-protocolo.usecase';
import { CancelarOuMarcarProblemaProtocoloUseCase } from './aplicacao/casos-de-uso/cancelar-ou-marcar-problema-protocolo.usecase';
import { CriarProtocoloUseCase } from './aplicacao/casos-de-uso/criar-protocolo.usecase';
import { ExcluirProtocoloUseCase } from './aplicacao/casos-de-uso/excluir-protocolo.usecase';
import { ListarProtocolosUseCase } from './aplicacao/casos-de-uso/listar-protocolos.usecase';
import { ObterProtocoloUseCase } from './aplicacao/casos-de-uso/obter-protocolo.usecase';
import { ObterUrlAnexoUseCase } from './aplicacao/casos-de-uso/obter-url-anexo.usecase';
import { ObterUrlFotoEntregaUseCase } from './aplicacao/casos-de-uso/obter-url-foto-entrega.usecase';
import { RegistrarEntregaProtocoloUseCase } from './aplicacao/casos-de-uso/registrar-entrega-protocolo.usecase';
import { PROTOCOLOS_REPOSITORIO } from './aplicacao/portas/protocolos-repositorio.port';
import { ProtocolosController } from './apresentacao/protocolos.controller';
import { ProtocolosRepositorioSupabase } from './infraestrutura/protocolos.repositorio.supabase';
import { StorageProtocolosService } from './infraestrutura/storage-protocolos.service';

@Module({
  imports: [EmpresasModule, ClientesModule],
  controllers: [ProtocolosController],
  providers: [
    { provide: PROTOCOLOS_REPOSITORIO, useClass: ProtocolosRepositorioSupabase },
    StorageProtocolosService,
    CriarProtocoloUseCase,
    ListarProtocolosUseCase,
    ObterProtocoloUseCase,
    AtualizarProtocoloUseCase,
    AvancarStatusProtocoloUseCase,
    RegistrarEntregaProtocoloUseCase,
    CancelarOuMarcarProblemaProtocoloUseCase,
    ExcluirProtocoloUseCase,
    ObterUrlAnexoUseCase,
    ObterUrlFotoEntregaUseCase,
  ],
})
export class ProtocolosModule {}
