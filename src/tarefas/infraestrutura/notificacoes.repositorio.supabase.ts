import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { Notificacao, NotificacoesRepositorioPort } from '../aplicacao/portas/notificacoes-repositorio.port';

interface LinhaNotificacao {
  id: string;
  usuario_id: string;
  tarefa_id: string | null;
  mensagem: string;
  lida: boolean;
  criado_em: string;
}

const COLUNAS = 'id, usuario_id, tarefa_id, mensagem, lida, criado_em';

@Injectable()
export class NotificacoesRepositorioSupabase implements NotificacoesRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: { usuarioId: string; tarefaId: string | null; mensagem: string }): Promise<Notificacao> {
    const { data, error } = await this.supabase.admin
      .from('notificacoes')
      .insert({ usuario_id: dados.usuarioId, tarefa_id: dados.tarefaId, mensagem: dados.mensagem })
      .select(COLUNAS)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar notificação: ${error.message}`);
    return this.mapear(data as LinhaNotificacao);
  }

  async listarPorUsuario(usuarioId: string): Promise<Notificacao[]> {
    const { data, error } = await this.supabase.admin
      .from('notificacoes')
      .select(COLUNAS)
      .eq('usuario_id', usuarioId)
      .order('criado_em', { ascending: false })
      .limit(50);
    if (error) throw new InternalServerErrorException(`Falha ao listar notificações: ${error.message}`);
    return (data as LinhaNotificacao[]).map((linha) => this.mapear(linha));
  }

  async marcarLida(id: string, usuarioId: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('notificacoes')
      .update({ lida: true })
      .eq('id', id)
      .eq('usuario_id', usuarioId);
    if (error) throw new InternalServerErrorException(`Falha ao marcar notificação como lida: ${error.message}`);
  }

  private mapear(linha: LinhaNotificacao): Notificacao {
    return {
      id: linha.id,
      usuarioId: linha.usuario_id,
      tarefaId: linha.tarefa_id,
      mensagem: linha.mensagem,
      lida: linha.lida,
      criadoEm: linha.criado_em,
    };
  }
}
