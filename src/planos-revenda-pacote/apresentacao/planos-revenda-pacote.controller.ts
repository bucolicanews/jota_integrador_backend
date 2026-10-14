import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import { AtualizarPlanoRevendaUseCase } from '../aplicacao/casos-de-uso/atualizar-plano-revenda.usecase';
import { CriarPlanoRevendaUseCase } from '../aplicacao/casos-de-uso/criar-plano-revenda.usecase';
import { ListarPlanosRevendaUseCase } from '../aplicacao/casos-de-uso/listar-planos-revenda.usecase';
import { PlanoRevendaPacote } from '../aplicacao/portas/planos-revenda-pacote-repositorio.port';
import { AtualizarPlanoRevendaDto } from './dto/atualizar-plano-revenda.dto';
import { CriarPlanoRevendaDto } from './dto/criar-plano-revenda.dto';

// Mesmo padrão de posse de LicencasModuloController -- plataforma vê tudo, contador só
// os próprios planos de revenda.
@Controller('contadores/:contadorId/planos-revenda-pacote')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class PlanosRevendaPacoteController {
  constructor(
    private readonly criarPlano: CriarPlanoRevendaUseCase,
    private readonly listarPlanos: ListarPlanosRevendaUseCase,
    private readonly atualizarPlano: AtualizarPlanoRevendaUseCase,
  ) {}

  @Get()
  async listar(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<PlanoRevendaPacote[]> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.listarPlanos.executar(contadorId);
  }

  @Post()
  async criar(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Body() dto: CriarPlanoRevendaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<PlanoRevendaPacote> {
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
    @Body() dto: AtualizarPlanoRevendaDto,
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
