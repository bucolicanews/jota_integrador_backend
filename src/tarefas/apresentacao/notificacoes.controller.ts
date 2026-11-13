import { Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ListarNotificacoesUseCase } from '../aplicacao/casos-de-uso/listar-notificacoes.usecase';
import { MarcarNotificacaoLidaUseCase } from '../aplicacao/casos-de-uso/marcar-notificacao-lida.usecase';
import { Notificacao } from '../aplicacao/portas/notificacoes-repositorio.port';

/** Pessoal, não por empresa -- sem `@Papeis(...)` de propósito, igual `/auth/me` (qualquer papel autenticado vê/marca só as próprias). */
@Controller('notificacoes')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class NotificacoesController {
  constructor(
    private readonly listarNotificacoes: ListarNotificacoesUseCase,
    private readonly marcarNotificacaoLida: MarcarNotificacaoLidaUseCase,
  ) {}

  @Get()
  async listar(@UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<Notificacao[]> {
    return this.listarNotificacoes.executar(usuarioAtual.id);
  }

  @Patch(':id/lida')
  async marcarLida(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    await this.marcarNotificacaoLida.executar(id, usuarioAtual.id);
    return { ok: true };
  }
}
