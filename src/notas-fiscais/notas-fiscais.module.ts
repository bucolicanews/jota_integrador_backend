import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { ContasAPagarModule } from '../contas-a-pagar/contas-a-pagar.module';
import { ContasAReceberModule } from '../contas-a-receber/contas-a-receber.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { FornecedoresModule } from '../fornecedores/fornecedores.module';
import { LancamentosContabeisModule } from '../lancamentos-contabeis/lancamentos-contabeis.module';
import { PlanoDeContasModule } from '../plano-de-contas/plano-de-contas.module';
import { AprovarNotaFiscalUseCase } from './aplicacao/casos-de-uso/aprovar-nota-fiscal.usecase';
import { BuscarConfiguracaoLancamentosNfUseCase } from './aplicacao/casos-de-uso/buscar-configuracao-lancamentos-nf.usecase';
import { GerarTokenAgenteUseCase } from './aplicacao/casos-de-uso/gerar-token-agente.usecase';
import { IngerirNotaFiscalUseCase } from './aplicacao/casos-de-uso/ingerir-nota-fiscal.usecase';
import { ListarNotasFiscaisPendentesUseCase } from './aplicacao/casos-de-uso/listar-notas-fiscais-pendentes.usecase';
import { ListarItensApuracaoTributariaUseCase } from './aplicacao/casos-de-uso/listar-itens-apuracao-tributaria.usecase';
import { ListarNotasFiscaisPorPeriodoUseCase } from './aplicacao/casos-de-uso/listar-notas-fiscais-por-periodo.usecase';
import { ObterDetalheNotaFiscalUseCase } from './aplicacao/casos-de-uso/obter-detalhe-nota-fiscal.usecase';
import { ObterStatusAgenteUseCase } from './aplicacao/casos-de-uso/obter-status-agente.usecase';
import { ObterUrlDownloadAgenteUseCase } from './aplicacao/casos-de-uso/obter-url-download-agente.usecase';
import { ObterUrlXmlNotaFiscalUseCase } from './aplicacao/casos-de-uso/obter-url-xml-nota-fiscal.usecase';
import { RejeitarNotaFiscalUseCase } from './aplicacao/casos-de-uso/rejeitar-nota-fiscal.usecase';
import { RevogarTokenAgenteUseCase } from './aplicacao/casos-de-uso/revogar-token-agente.usecase';
import { SalvarConfiguracaoLancamentosNfUseCase } from './aplicacao/casos-de-uso/salvar-configuracao-lancamentos-nf.usecase';
import { AGENTES_NOTAS_FISCAIS_REPOSITORIO } from './aplicacao/portas/agentes-notas-fiscais-repositorio.port';
import { NOTAS_FISCAIS_REPOSITORIO } from './aplicacao/portas/notas-fiscais-repositorio.port';
import { IngestaoNotasFiscaisController } from './apresentacao/ingestao-notas-fiscais.controller';
import { NotasFiscaisController } from './apresentacao/notas-fiscais.controller';
import { AgentesNotasFiscaisRepositorioSupabase } from './infraestrutura/agentes-notas-fiscais.repositorio.supabase';
import { TokenAgenteGuard } from './infraestrutura/auth/token-agente.guard';
import { NotasFiscaisRepositorioSupabase } from './infraestrutura/notas-fiscais.repositorio.supabase';
import { StorageNotasFiscaisService } from './infraestrutura/storage-notas-fiscais.service';

@Module({
  // FornecedoresModule/ClientesModule -- dedupe/cadastro automático na ingestão.
  // ContasAPagarModule/ContasAReceberModule -- AprovarNotaFiscalUseCase reaproveita
  // CriarContaPagarUseCase/CriarContaReceberUseCase (conta+parcelas+lançamento já prontos)
  // pra entrada e pra saída a prazo/cartão/PIX.
  // LancamentosContabeisModule -- NFCe 100% dinheiro à vista nunca passa por Contas a
  // Receber: lança direto D Caixa/C Receita (LANCAMENTOS_REPOSITORIO.criar), 1 lançamento só.
  // PlanoDeContasModule -- validação das contas na config de lançamentos.
  imports: [EmpresasModule, FornecedoresModule, ClientesModule, ContasAPagarModule, ContasAReceberModule, LancamentosContabeisModule, PlanoDeContasModule],
  controllers: [NotasFiscaisController, IngestaoNotasFiscaisController],
  providers: [
    { provide: NOTAS_FISCAIS_REPOSITORIO, useClass: NotasFiscaisRepositorioSupabase },
    { provide: AGENTES_NOTAS_FISCAIS_REPOSITORIO, useClass: AgentesNotasFiscaisRepositorioSupabase },
    StorageNotasFiscaisService,
    TokenAgenteGuard,
    IngerirNotaFiscalUseCase,
    ListarNotasFiscaisPendentesUseCase,
    ListarNotasFiscaisPorPeriodoUseCase,
    ObterDetalheNotaFiscalUseCase,
    ObterUrlXmlNotaFiscalUseCase,
    AprovarNotaFiscalUseCase,
    RejeitarNotaFiscalUseCase,
    BuscarConfiguracaoLancamentosNfUseCase,
    SalvarConfiguracaoLancamentosNfUseCase,
    GerarTokenAgenteUseCase,
    RevogarTokenAgenteUseCase,
    ObterStatusAgenteUseCase,
    ObterUrlDownloadAgenteUseCase,
    ListarItensApuracaoTributariaUseCase,
  ],
  // NOTAS_FISCAIS_REPOSITORIO exportado pro módulo apuracao-simples reaproveitar
  // listarPorPeriodo (RBT12 deriva receita de comercio_industria das notas de saída
  // aprovadas) em vez de duplicar a query. TokenAgenteGuard/AGENTES_NOTAS_FISCAIS_REPOSITORIO
  // exportados pro módulo notas-servico reaproveitar o mesmo agente local/token -- NFS-e não
  // é um tipo de credencial novo, é só mais um endpoint de upload da mesma máquina.
  exports: [NOTAS_FISCAIS_REPOSITORIO, TokenAgenteGuard, AGENTES_NOTAS_FISCAIS_REPOSITORIO],
})
export class NotasFiscaisModule {}
