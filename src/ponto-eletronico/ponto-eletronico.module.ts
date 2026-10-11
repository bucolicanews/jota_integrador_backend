import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { AjustarRegistrosDoDiaUseCase } from './aplicacao/casos-de-uso/ajustar-registros-do-dia.usecase';
import { CancelarFeriasUseCase } from './aplicacao/casos-de-uso/cancelar-ferias.usecase';
import { ConfigurarFuncionarioUseCase } from './aplicacao/casos-de-uso/configurar-funcionario.usecase';
import { CriarFeriasUseCase } from './aplicacao/casos-de-uso/criar-ferias.usecase';
import { ExcluirRegistroUseCase } from './aplicacao/casos-de-uso/excluir-registro.usecase';
import { LancarFaltaOuAbonoUseCase } from './aplicacao/casos-de-uso/lancar-falta-ou-abono.usecase';
import { LancarFolgaTrabalhadaUseCase } from './aplicacao/casos-de-uso/lancar-folga-trabalhada.usecase';
import { ListarFeriasUseCase } from './aplicacao/casos-de-uso/listar-ferias.usecase';
import { ListarRegistrosUseCase } from './aplicacao/casos-de-uso/listar-registros.usecase';
import { ObterConfiguracaoFuncionarioUseCase } from './aplicacao/casos-de-uso/obter-configuracao-funcionario.usecase';
import { ObterResumoMensalUseCase } from './aplicacao/casos-de-uso/obter-resumo-mensal.usecase';
import { ObterUrlAtestadoUseCase } from './aplicacao/casos-de-uso/obter-url-atestado.usecase';
import { ObterUrlSelfieUseCase } from './aplicacao/casos-de-uso/obter-url-selfie.usecase';
import { RegistrarBatidaUseCase } from './aplicacao/casos-de-uso/registrar-batida.usecase';
import { CONFIGURACAO_FUNCIONARIO_REPOSITORIO } from './aplicacao/portas/configuracao-funcionario-repositorio.port';
import { FERIAS_PONTO_REPOSITORIO } from './aplicacao/portas/ferias-ponto-repositorio.port';
import { REGISTROS_PONTO_REPOSITORIO } from './aplicacao/portas/registros-ponto-repositorio.port';
import { PontoEletronicoController } from './apresentacao/ponto-eletronico.controller';
import { ConfiguracaoFuncionarioRepositorioSupabase } from './infraestrutura/configuracao-funcionario.repositorio.supabase';
import { FeriasPontoRepositorioSupabase } from './infraestrutura/ferias-ponto.repositorio.supabase';
import { RegistrosPontoRepositorioSupabase } from './infraestrutura/registros-ponto.repositorio.supabase';
import { StoragePontoService } from './infraestrutura/storage-ponto.service';

@Module({
  imports: [EmpresasModule],
  controllers: [PontoEletronicoController],
  providers: [
    { provide: REGISTROS_PONTO_REPOSITORIO, useClass: RegistrosPontoRepositorioSupabase },
    { provide: FERIAS_PONTO_REPOSITORIO, useClass: FeriasPontoRepositorioSupabase },
    { provide: CONFIGURACAO_FUNCIONARIO_REPOSITORIO, useClass: ConfiguracaoFuncionarioRepositorioSupabase },
    StoragePontoService,
    RegistrarBatidaUseCase,
    ListarRegistrosUseCase,
    ObterResumoMensalUseCase,
    LancarFaltaOuAbonoUseCase,
    LancarFolgaTrabalhadaUseCase,
    AjustarRegistrosDoDiaUseCase,
    ExcluirRegistroUseCase,
    ConfigurarFuncionarioUseCase,
    ObterConfiguracaoFuncionarioUseCase,
    CriarFeriasUseCase,
    ListarFeriasUseCase,
    CancelarFeriasUseCase,
    ObterUrlSelfieUseCase,
    ObterUrlAtestadoUseCase,
  ],
})
export class PontoEletronicoModule {}
