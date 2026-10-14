import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { Papel } from '../../auth/dominio/papel';
import { AtualizarPacoteModulosUseCase } from '../aplicacao/casos-de-uso/atualizar-pacote-modulos.usecase';
import { CriarPacoteModulosUseCase } from '../aplicacao/casos-de-uso/criar-pacote-modulos.usecase';
import { DesativarPacoteModulosUseCase } from '../aplicacao/casos-de-uso/desativar-pacote-modulos.usecase';
import { ListarPacotesModulosUseCase } from '../aplicacao/casos-de-uso/listar-pacotes-modulos.usecase';
import { PacoteModulos } from '../aplicacao/portas/pacotes-modulos-repositorio.port';
import { AtualizarPacoteModulosDto } from './dto/atualizar-pacote-modulos.dto';
import { CriarPacoteModulosDto } from './dto/criar-pacote-modulos.dto';

// Catálogo de venda -- qualquer autenticado pode LISTAR (contador precisa ver o que existe
// pra comprar), só plataforma pode criar/editar/desativar. Mesmo padrão de
// ContadoresController (criar contador é ação exclusiva de SUPER_ADMIN).
@Controller('pacotes-modulos')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class PacotesModulosController {
  constructor(
    private readonly criarPacote: CriarPacoteModulosUseCase,
    private readonly listarPacotes: ListarPacotesModulosUseCase,
    private readonly atualizarPacote: AtualizarPacoteModulosUseCase,
    private readonly desativarPacote: DesativarPacoteModulosUseCase,
  ) {}

  @Get()
  async listar(@Query('apenasAtivos') apenasAtivos?: string): Promise<PacoteModulos[]> {
    return this.listarPacotes.executar(apenasAtivos === 'true');
  }

  @Post()
  @Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO)
  async criar(@Body() dto: CriarPacoteModulosDto): Promise<PacoteModulos> {
    return this.criarPacote.executar({
      nome: dto.nome,
      descricao: dto.descricao ?? null,
      modulos: dto.modulos,
      preco: dto.preco,
      periodicidade: dto.periodicidade,
      dataValidade: dto.dataValidade ?? null,
      gratuito: dto.gratuito ?? false,
    });
  }

  @Patch(':id')
  @Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO)
  async atualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarPacoteModulosDto): Promise<{ ok: true }> {
    await this.atualizarPacote.executar(id, dto);
    return { ok: true };
  }

  @Patch(':id/ativo')
  @Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO)
  async alternarAtivo(@Param('id', ParseUUIDPipe) id: string, @Body('ativo') ativo: boolean): Promise<{ ok: true }> {
    await this.desativarPacote.executar(id, ativo);
    return { ok: true };
  }
}
