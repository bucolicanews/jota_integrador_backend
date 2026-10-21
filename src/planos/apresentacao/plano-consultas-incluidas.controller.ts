import { Controller, Delete, Get, Param, ParseUUIDPipe, Put, Body, UseGuards } from '@nestjs/common';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { Papel } from '../../auth/dominio/papel';
import { DefinirConsultaIncluidaUseCase } from '../aplicacao/casos-de-uso/definir-consulta-incluida.usecase';
import { ListarConsultasIncluidasUseCase } from '../aplicacao/casos-de-uso/listar-consultas-incluidas.usecase';
import { RemoverConsultaIncluidaUseCase } from '../aplicacao/casos-de-uso/remover-consulta-incluida.usecase';
import { ConsultaIncluidaPlano } from '../aplicacao/portas/plano-consultas-incluidas-repositorio.port';
import { DefinirConsultaIncluidaDto } from './dto/definir-consulta-incluida.dto';

// Catálogo de cota incluída por plano -- leitura pública (qualquer autenticado, igual
// PlanosController.listar), escrita só plataforma (mesmo padrão de planos/pacotes).
@Controller('planos/:planoId/consultas-incluidas')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class PlanoConsultasIncluidasController {
  constructor(
    private readonly listarConsultasIncluidas: ListarConsultasIncluidasUseCase,
    private readonly definirConsultaIncluida: DefinirConsultaIncluidaUseCase,
    private readonly removerConsultaIncluida: RemoverConsultaIncluidaUseCase,
  ) {}

  @Get()
  async listar(@Param('planoId', ParseUUIDPipe) planoId: string): Promise<ConsultaIncluidaPlano[]> {
    return this.listarConsultasIncluidas.executar(planoId);
  }

  @Put(':idSistema')
  @Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO)
  async definir(
    @Param('planoId', ParseUUIDPipe) planoId: string,
    @Param('idSistema') idSistema: string,
    @Body() dto: DefinirConsultaIncluidaDto,
  ): Promise<ConsultaIncluidaPlano> {
    return this.definirConsultaIncluida.executar(planoId, idSistema, dto.quantidadePorPeriodo);
  }

  @Delete(':idSistema')
  @Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO)
  async remover(
    @Param('planoId', ParseUUIDPipe) planoId: string,
    @Param('idSistema') idSistema: string,
  ): Promise<{ ok: true }> {
    await this.removerConsultaIncluida.executar(planoId, idSistema);
    return { ok: true };
  }
}
