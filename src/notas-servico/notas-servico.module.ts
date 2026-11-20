import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { NotasFiscaisModule } from '../notas-fiscais/notas-fiscais.module';
import { AprovarNotaServicoUseCase } from './aplicacao/casos-de-uso/aprovar-nota-servico.usecase';
import { GerarDanfsePdfUseCase } from './aplicacao/casos-de-uso/gerar-danfse-pdf.usecase';
import { IngerirNotaServicoUseCase } from './aplicacao/casos-de-uso/ingerir-nota-servico.usecase';
import { ListarNotasServicoPendentesUseCase } from './aplicacao/casos-de-uso/listar-notas-servico-pendentes.usecase';
import { ListarNotasServicoPorPeriodoUseCase } from './aplicacao/casos-de-uso/listar-notas-servico-por-periodo.usecase';
import { ObterDetalheNotaServicoUseCase } from './aplicacao/casos-de-uso/obter-detalhe-nota-servico.usecase';
import { RejeitarNotaServicoUseCase } from './aplicacao/casos-de-uso/rejeitar-nota-servico.usecase';
import { NOTAS_SERVICO_REPOSITORIO } from './aplicacao/portas/notas-servico-repositorio.port';
import { IngestaoNotasServicoController } from './apresentacao/ingestao-notas-servico.controller';
import { NotasServicoController } from './apresentacao/notas-servico.controller';
import { GeradorDanfseClient } from './infraestrutura/gerador-danfse.client';
import { NotasServicoRepositorioSupabase } from './infraestrutura/notas-servico.repositorio.supabase';
import { StorageNotasServicoService } from './infraestrutura/storage-notas-servico.service';

@Module({
  // NotasFiscaisModule -- reaproveita TokenAgenteGuard/AGENTES_NOTAS_FISCAIS_REPOSITORIO
  // (mesmo agente local, não é credencial nova pra NFS-e).
  imports: [EmpresasModule, NotasFiscaisModule],
  controllers: [NotasServicoController, IngestaoNotasServicoController],
  providers: [
    { provide: NOTAS_SERVICO_REPOSITORIO, useClass: NotasServicoRepositorioSupabase },
    StorageNotasServicoService,
    IngerirNotaServicoUseCase,
    ListarNotasServicoPendentesUseCase,
    ListarNotasServicoPorPeriodoUseCase,
    ObterDetalheNotaServicoUseCase,
    AprovarNotaServicoUseCase,
    RejeitarNotaServicoUseCase,
    GeradorDanfseClient,
    GerarDanfsePdfUseCase,
  ],
})
export class NotasServicoModule {}
