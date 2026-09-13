import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { LadoMensagem } from '../dominio/ticket';
import { DadosNovaMensagem, MensagemTicket, MensagensRepositorioPort } from '../aplicacao/portas/mensagens-repositorio.port';

interface LinhaMensagem {
  id: string;
  ticket_id: string;
  remetente_id: string;
  remetente_lado: LadoMensagem;
  conteudo: string;
  anexo_nome: string | null;
  anexo_storage_ref: string | null;
  criado_em: string;
}

const COLUNAS = 'id, ticket_id, remetente_id, remetente_lado, conteudo, anexo_nome, anexo_storage_ref, criado_em';

@Injectable()
export class MensagensRepositorioSupabase implements MensagensRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovaMensagem): Promise<MensagemTicket> {
    const { data, error } = await this.supabase.admin
      .from('suporte_mensagens')
      .insert({
        ticket_id: dados.ticketId,
        remetente_id: dados.remetenteId,
        remetente_lado: dados.remetenteLado,
        conteudo: dados.conteudo,
        anexo_nome: dados.anexoNome,
        anexo_storage_ref: dados.anexoStorageRef,
      })
      .select(COLUNAS)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao gravar mensagem: ${error.message}`);
    return this.mapear(data as LinhaMensagem);
  }

  async listarPorTicket(ticketId: string): Promise<MensagemTicket[]> {
    const { data, error } = await this.supabase.admin
      .from('suporte_mensagens')
      .select(COLUNAS)
      .eq('ticket_id', ticketId)
      .order('criado_em', { ascending: true });
    if (error) throw new InternalServerErrorException(`Falha ao listar mensagens: ${error.message}`);
    return (data as LinhaMensagem[]).map((linha) => this.mapear(linha));
  }

  async obterPorId(id: string): Promise<MensagemTicket | null> {
    const { data, error } = await this.supabase.admin.from('suporte_mensagens').select(COLUNAS).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar mensagem: ${error.message}`);
    return data ? this.mapear(data as LinhaMensagem) : null;
  }

  async obterUltimasPorTickets(ticketIds: string[]): Promise<Map<string, MensagemTicket>> {
    if (ticketIds.length === 0) return new Map();

    const { data, error } = await this.supabase.admin
      .from('suporte_mensagens')
      .select(COLUNAS)
      .in('ticket_id', ticketIds)
      .order('criado_em', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao buscar últimas mensagens: ${error.message}`);

    const ultimas = new Map<string, MensagemTicket>();
    for (const linha of data as LinhaMensagem[]) {
      // Já ordenado desc -- a primeira ocorrência de cada ticket_id é a mais recente.
      if (!ultimas.has(linha.ticket_id)) {
        ultimas.set(linha.ticket_id, this.mapear(linha));
      }
    }
    return ultimas;
  }

  private mapear(linha: LinhaMensagem): MensagemTicket {
    return {
      id: linha.id,
      ticketId: linha.ticket_id,
      remetenteId: linha.remetente_id,
      remetenteLado: linha.remetente_lado,
      conteudo: linha.conteudo,
      anexoNome: linha.anexo_nome,
      anexoStorageRef: linha.anexo_storage_ref,
      criadoEm: linha.criado_em,
    };
  }
}
