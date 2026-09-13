import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { DestinatarioTicket, PrioridadeTicket, StatusTicket } from '../dominio/ticket';
import { DadosNovoTicket, FiltroTickets, Ticket, TicketsRepositorioPort } from '../aplicacao/portas/tickets-repositorio.port';

interface LinhaTicket {
  id: string;
  titulo: string;
  status: StatusTicket;
  prioridade: PrioridadeTicket;
  destinatario_tipo: DestinatarioTicket;
  contador_id: string;
  empresa_id: string | null;
  ticket_referencia_id: string | null;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
}

const COLUNAS = 'id, titulo, status, prioridade, destinatario_tipo, contador_id, empresa_id, ticket_referencia_id, criado_por, criado_em, atualizado_em';

@Injectable()
export class TicketsRepositorioSupabase implements TicketsRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoTicket): Promise<Ticket> {
    const { data, error } = await this.supabase.admin
      .from('suporte_tickets')
      .insert({
        titulo: dados.titulo,
        prioridade: dados.prioridade,
        destinatario_tipo: dados.destinatarioTipo,
        contador_id: dados.contadorId,
        empresa_id: dados.empresaId,
        ticket_referencia_id: dados.ticketReferenciaId,
        criado_por: dados.criadoPor,
      })
      .select(COLUNAS)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar ticket: ${error.message}`);
    return this.mapear(data as LinhaTicket);
  }

  async listar(filtro: FiltroTickets): Promise<Ticket[]> {
    let query = this.supabase.admin.from('suporte_tickets').select(COLUNAS).order('atualizado_em', { ascending: false });
    if (filtro.contadorId) query = query.eq('contador_id', filtro.contadorId);
    if (filtro.empresaId) query = query.eq('empresa_id', filtro.empresaId);
    if (filtro.destinatarioTipo) query = query.eq('destinatario_tipo', filtro.destinatarioTipo);
    if (filtro.status) query = query.eq('status', filtro.status);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(`Falha ao listar tickets: ${error.message}`);
    return (data as LinhaTicket[]).map((linha) => this.mapear(linha));
  }

  async obterPorId(id: string): Promise<Ticket | null> {
    const { data, error } = await this.supabase.admin.from('suporte_tickets').select(COLUNAS).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar ticket: ${error.message}`);
    return data ? this.mapear(data as LinhaTicket) : null;
  }

  async atualizarStatus(id: string, status: StatusTicket): Promise<void> {
    const { error } = await this.supabase.admin.from('suporte_tickets').update({ status }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar status do ticket: ${error.message}`);
  }

  async atualizarPrioridade(id: string, prioridade: PrioridadeTicket): Promise<void> {
    const { error } = await this.supabase.admin.from('suporte_tickets').update({ prioridade }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar prioridade do ticket: ${error.message}`);
  }

  async excluir(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('suporte_tickets').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir ticket: ${error.message}`);
  }

  private mapear(linha: LinhaTicket): Ticket {
    return {
      id: linha.id,
      titulo: linha.titulo,
      status: linha.status,
      prioridade: linha.prioridade,
      destinatarioTipo: linha.destinatario_tipo,
      contadorId: linha.contador_id,
      empresaId: linha.empresa_id,
      ticketReferenciaId: linha.ticket_referencia_id,
      criadoPor: linha.criado_por,
      criadoEm: linha.criado_em,
      atualizadoEm: linha.atualizado_em,
    };
  }
}
