import { Module } from '@nestjs/common';
import { ContadoresModule } from '../contadores/contadores.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { PagbankModule } from '../common/pagbank/pagbank.module';
import { CriarCobrancaHonorarioUseCase } from './aplicacao/casos-de-uso/criar-cobranca-honorario.usecase';
import { GerenciarComissaoPlataformaUseCase } from './aplicacao/casos-de-uso/gerenciar-comissao-plataforma.usecase';
import { GerenciarConfiguracaoPagbankUseCase } from './aplicacao/casos-de-uso/gerenciar-configuracao-pagbank.usecase';
import { ListarCobrancasHonorarioUseCase } from './aplicacao/casos-de-uso/listar-cobrancas-honorario.usecase';
import { ProcessarWebhookPagbankHonorarioUseCase } from './aplicacao/casos-de-uso/processar-webhook-pagbank-honorario.usecase';
import { COBRANCAS_HONORARIOS_REPOSITORIO } from './aplicacao/portas/cobrancas-honorarios-repositorio.port';
import { CONFIGURACAO_PLATAFORMA_REPOSITORIO } from './aplicacao/portas/configuracao-plataforma-repositorio.port';
import { ConfiguracaoPlataformaController } from './apresentacao/configuracao-plataforma.controller';
import { HonorariosController } from './apresentacao/honorarios.controller';
import { WebhookPagbankHonorariosController } from './apresentacao/webhook-pagbank-honorarios.controller';
import { CobrancasHonorariosRepositorioSupabase } from './infraestrutura/cobrancas-honorarios.repositorio.supabase';
import { ConfiguracaoPlataformaRepositorioSupabase } from './infraestrutura/configuracao-plataforma.repositorio.supabase';

@Module({
  // ContadoresModule (CONTADORES_REPOSITORIO) -- pagbankAccountId do contador, gating de
  // cobrança. EmpresasModule (EMPRESAS_REPOSITORIO) -- checagem de posse (empresa
  // pertence à carteira). PagbankModule -- PagbankConfigService (split/webhook/client).
  imports: [ContadoresModule, EmpresasModule, PagbankModule],
  controllers: [HonorariosController, ConfiguracaoPlataformaController, WebhookPagbankHonorariosController],
  providers: [
    { provide: COBRANCAS_HONORARIOS_REPOSITORIO, useClass: CobrancasHonorariosRepositorioSupabase },
    { provide: CONFIGURACAO_PLATAFORMA_REPOSITORIO, useClass: ConfiguracaoPlataformaRepositorioSupabase },
    CriarCobrancaHonorarioUseCase,
    ListarCobrancasHonorarioUseCase,
    GerenciarComissaoPlataformaUseCase,
    GerenciarConfiguracaoPagbankUseCase,
    ProcessarWebhookPagbankHonorarioUseCase,
  ],
})
export class HonorariosModule {}
