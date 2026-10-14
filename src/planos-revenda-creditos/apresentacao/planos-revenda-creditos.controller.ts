import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import { AtualizarPlanoRevendaCreditoUseCase } from '../aplicacao/casos-de-uso/atualizar-plano-revenda-credito.usecase';
import { CriarPlanoRevendaCreditoUseCase } from '../aplicacao/casos-de-uso/criar-plano-revenda-credito.usecase';
import { ListarPlanosRevendaCreditosUseCase } from '../aplicacao/casos-de-uso/listar-planos-revenda-creditos.usecase';
import { PlanoRevendaCredito } from '../aplicacao/portas/planos-revenda-creditos-repositorio.port';
import { AtualizarPlanoRevendaCreditoDto } from './dto/atualizar-plano-revenda-credito.dto';
import { CriarPlanoRevendaCreditoDto } from './dto/criar-plano-revenda-credito.dto';

// Mesmo padrão de posse de PlanosRevendaPacoteController -- plataforma vê tudo, contador
// só os próprios planos de revenda.
@Controller('contadores/:contadorId/planos-revenda-creditos')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class PlanosRevendaCreditosController {
  constructor(
    private readonly criarPlano: CriarPlanoRevendaCreditoUseCase,
    private readonly listarPlanos: ListarPlanosRevendaCreditosUseCase,
    private readonly atualizarPlano: AtualizarPlanoRevendaCreditoUseCase,
  ) {}

  @Get()
  async listar(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<PlanoRevendaCredito[]> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.listarPlanos.executar(contadorId);
  }

  @Post()
  async criar(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Body() dto: CriarPlanoRevendaCreditoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<PlanoRevendaCredito> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.criarPlano.executar({
      contadorId,
      planoId: dto.planoId,
      nome: dto.nome ?? null,
      valorVenda: dto.valorVenda,
    });
  }

  @Patch(':id')
  async atualizar(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarPlanoRevendaCreditoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    this.exigirPosse(usuarioAtual, contadorId);
    await this.atualizarPlano.executar(id, dto);
    return { ok: true };
  }

  private exigirPosse(usuarioAtual: UsuarioAutenticado, contadorId: string): void {
    if (ehPapelDePlataforma(usuarioAtual.papel)) return;
    if (usuarioAtual.contadorId !== contadorId) {
      throw new ForbiddenException('Sem autoridade sobre os planos de revenda deste contador');
    }
  }
}
