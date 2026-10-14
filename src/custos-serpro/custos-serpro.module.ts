import { Module } from '@nestjs/common';
import { DefinirCustoConsultaSerproUseCase } from './aplicacao/casos-de-uso/definir-custo-consulta-serpro.usecase';
import { GerarRelatorioConsultasSerproUseCase } from './aplicacao/casos-de-uso/gerar-relatorio-consultas-serpro.usecase';
import { ListarCustosConsultaSerproUseCase } from './aplicacao/casos-de-uso/listar-custos-consulta-serpro.usecase';
import { RemoverCustoConsultaSerproUseCase } from './aplicacao/casos-de-uso/remover-custo-consulta-serpro.usecase';
import { CUSTOS_CONSULTAS_SERPRO_REPOSITORIO } from './aplicacao/portas/custos-consultas-serpro-repositorio.port';
import { RELATORIO_CONSULTAS_SERPRO_REPOSITORIO } from './aplicacao/portas/relatorio-consultas-serpro-repositorio.port';
import { CustosConsultasSerproController } from './apresentacao/custos-consultas-serpro.controller';
import { CustosConsultasSerproRepositorioSupabase } from './infraestrutura/custos-consultas-serpro.repositorio.supabase';
import { RelatorioConsultasSerproRepositorioSupabase } from './infraestrutura/relatorio-consultas-serpro.repositorio.supabase';

@Module({
  controllers: [CustosConsultasSerproController],
  providers: [
    { provide: CUSTOS_CONSULTAS_SERPRO_REPOSITORIO, useClass: CustosConsultasSerproRepositorioSupabase },
    { provide: RELATORIO_CONSULTAS_SERPRO_REPOSITORIO, useClass: RelatorioConsultasSerproRepositorioSupabase },
    ListarCustosConsultaSerproUseCase,
    DefinirCustoConsultaSerproUseCase,
    RemoverCustoConsultaSerproUseCase,
    GerarRelatorioConsultasSerproUseCase,
  ],
})
export class CustosSerproModule {}
