import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma, Papel } from '../../auth/dominio/papel';
import { AtualizarPacoteCreditoAvulsoUseCase } from '../aplicacao/casos-de-uso/atualizar-pacote-credito-avulso.usecase';
import { CriarPacoteCreditoAvulsoUseCase } from '../aplicacao/casos-de-uso/criar-pacote-credito-avulso.usecase';
import { ListarPacotesCreditosAvulsosUseCase } from '../aplicacao/casos-de-uso/listar-pacotes-creditos-avulsos.usecase';
import { PacoteCreditoAvulso } from '../aplicacao/portas/pacotes-creditos-avulsos-repositorio.port';
import { AtualizarPacoteCreditoAvulsoDto } from './dto/atualizar-pacote-credito-avulso.dto';
import { CriarPacoteCreditoAvulsoDto } from './dto/criar-pacote-credito-avulso.dto';

// Catálogo de pacotes de crédito avulso -- leitura pública (qualquer autenticado, mesmo
// padrão de PlanosController.listar: empresa precisa ver o que pode comprar), escrita só
// plataforma.
@Controller('pacotes-creditos-avulsos')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class PacotesCreditosAvulsosController {
  constructor(
    private readonly listarPacotes: ListarPacotesCreditosAvulsosUseCase,
    private readonly criarPacote: CriarPacoteCreditoAvulsoUseCase,
    private readonly atualizarPacote: AtualizarPacoteCreditoAvulsoUseCase,
  ) {}

  @Get()
  async listar(@UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<PacoteCreditoAvulso[]> {
    const somenteAtivos = !ehPapelDePlataforma(usuarioAtual.papel);
    return this.listarPacotes.executar(somenteAtivos);
  }

  @Post()
  @Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO)
  async criar(@Body() dto: CriarPacoteCreditoAvulsoDto): Promise<PacoteCreditoAvulso> {
    return this.criarPacote.executar(dto);
  }

  @Patch(':id')
  @Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO)
  async atualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarPacoteCreditoAvulsoDto): Promise<PacoteCreditoAvulso> {
    return this.atualizarPacote.executar(id, dto);
  }
}
