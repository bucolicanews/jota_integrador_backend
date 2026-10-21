import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { Papel } from '../../auth/dominio/papel';
import { DefinirCustoConsultaSerproUseCase } from '../aplicacao/casos-de-uso/definir-custo-consulta-serpro.usecase';
import { GerarRelatorioConsultasSerproUseCase } from '../aplicacao/casos-de-uso/gerar-relatorio-consultas-serpro.usecase';
import { ListarCustosConsultaSerproUseCase } from '../aplicacao/casos-de-uso/listar-custos-consulta-serpro.usecase';
import { RemoverCustoConsultaSerproUseCase } from '../aplicacao/casos-de-uso/remover-custo-consulta-serpro.usecase';
import { CustoConsultaSerpro } from '../aplicacao/portas/custos-consultas-serpro-repositorio.port';
import { LinhaRelatorioConsultas } from '../aplicacao/portas/relatorio-consultas-serpro-repositorio.port';
import { DefinirCustoConsultaSerproDto } from './dto/definir-custo-consulta-serpro.dto';
import { FiltroRelatorioConsultasSerproDto } from './dto/filtro-relatorio-consultas-serpro.dto';

// Uso 100% interno do admin -- custo real de cada consulta ao SERPRO pra Jota (margem,
// não cobrança). NUNCA visível pro contador (docs/UX-UI.md: operações fiscais nunca
// detalhadas granularmente pro cliente final -- aqui é o oposto, uso interno da
// plataforma, por isso @Papeis em TODAS as rotas, sem exceção de leitura pública).
@Controller('custos-consultas-serpro')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
@Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO)
export class CustosConsultasSerproController {
  constructor(
    private readonly listarCustos: ListarCustosConsultaSerproUseCase,
    private readonly definirCusto: DefinirCustoConsultaSerproUseCase,
    private readonly removerCusto: RemoverCustoConsultaSerproUseCase,
    private readonly gerarRelatorio: GerarRelatorioConsultasSerproUseCase,
  ) {}

  @Get()
  async listar(): Promise<CustoConsultaSerpro[]> {
    return this.listarCustos.executar();
  }

  @Get('relatorio')
  async relatorio(@Query() filtro: FiltroRelatorioConsultasSerproDto): Promise<LinhaRelatorioConsultas[]> {
    return this.gerarRelatorio.executar(filtro);
  }

  @Put(':idSistema')
  async definir(
    @Param('idSistema') idSistema: string,
    @Body() dto: DefinirCustoConsultaSerproDto,
  ): Promise<CustoConsultaSerpro> {
    return this.definirCusto.executar(idSistema, dto.custoReais, dto.precoVendaReais);
  }

  @Delete(':idSistema')
  async remover(@Param('idSistema') idSistema: string): Promise<{ ok: true }> {
    await this.removerCusto.executar(idSistema);
    return { ok: true };
  }
}
