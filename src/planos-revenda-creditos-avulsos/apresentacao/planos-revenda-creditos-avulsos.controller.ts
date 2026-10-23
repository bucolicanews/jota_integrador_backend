import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import { AtualizarPlanoRevendaCreditoAvulsoUseCase } from '../aplicacao/casos-de-uso/atualizar-plano-revenda-credito-avulso.usecase';
import { CriarPlanoRevendaCreditoAvulsoUseCase } from '../aplicacao/casos-de-uso/criar-plano-revenda-credito-avulso.usecase';
import { ListarPlanosRevendaCreditosAvulsosUseCase } from '../aplicacao/casos-de-uso/listar-planos-revenda-creditos-avulsos.usecase';
import { PlanoRevendaCreditoAvulso } from '../aplicacao/portas/planos-revenda-creditos-avulsos-repositorio.port';
import { AtualizarPlanoRevendaCreditoAvulsoDto } from './dto/atualizar-plano-revenda-credito-avulso.dto';
import { CriarPlanoRevendaCreditoAvulsoDto } from './dto/criar-plano-revenda-credito-avulso.dto';

// Mesmo padrão de posse de PlanosRevendaPacoteController -- plataforma vê tudo, contador
// só os próprios planos de revenda de crédito avulso.
@Controller('contadores/:contadorId/planos-revenda-creditos-avulsos')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class PlanosRevendaCreditosAvulsosController {
  constructor(
    private readonly criarPlano: CriarPlanoRevendaCreditoAvulsoUseCase,
    private readonly listarPlanos: ListarPlanosRevendaCreditosAvulsosUseCase,
    private readonly atualizarPlano: AtualizarPlanoRevendaCreditoAvulsoUseCase,
  ) {}

  @Get()
  async listar(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<PlanoRevendaCreditoAvulso[]> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.listarPlanos.executar(contadorId);
  }

  @Post()
  async criar(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Body() dto: CriarPlanoRevendaCreditoAvulsoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<PlanoRevendaCreditoAvulso> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.criarPlano.executar({
      contadorId,
      pacoteId: dto.pacoteId,
      nome: dto.nome ?? null,
      valorVenda: dto.valorVenda,
    });
  }

  @Patch(':id')
  async atualizar(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarPlanoRevendaCreditoAvulsoDto,
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
