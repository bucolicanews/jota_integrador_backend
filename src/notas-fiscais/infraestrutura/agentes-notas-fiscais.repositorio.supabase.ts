import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { AgenteNotasFiscais, AgentesNotasFiscaisRepositorioPort } from '../aplicacao/portas/agentes-notas-fiscais-repositorio.port';

interface Linha {
  id: string;
  empresa_id: string;
  ativo: boolean;
  ultimo_uso_em: string | null;
  criado_em: string;
}

const COLUNAS = 'id, empresa_id, ativo, ultimo_uso_em, criado_em';

@Injectable()
export class AgentesNotasFiscaisRepositorioSupabase implements AgentesNotasFiscaisRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(empresaId: string, tokenHash: string, criadoPor: string): Promise<AgenteNotasFiscais> {
    await this.revogar(empresaId);

    const { data, error } = await this.supabase.admin
      .from('agentes_notas_fiscais')
      .insert({ empresa_id: empresaId, token_hash: tokenHash, criado_por: criadoPor })
      .select(COLUNAS)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao gerar token do agente: ${error.message}`);
    return this.mapear(data as Linha);
  }

  async buscarPorTokenHash(tokenHash: string): Promise<{ id: string; empresaId: string } | null> {
    const { data, error } = await this.supabase.admin
      .from('agentes_notas_fiscais')
      .select('id, empresa_id')
      .eq('token_hash', tokenHash)
      .eq('ativo', true)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao validar token do agente: ${error.message}`);
    return data ? { id: data.id as string, empresaId: data.empresa_id as string } : null;
  }

  async buscarAtivoPorEmpresa(empresaId: string): Promise<AgenteNotasFiscais | null> {
    const { data, error } = await this.supabase.admin
      .from('agentes_notas_fiscais')
      .select(COLUNAS)
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar status do agente: ${error.message}`);
    return data ? this.mapear(data as Linha) : null;
  }

  async revogar(empresaId: string): Promise<void> {
    const { error } = await this.supabase.admin.from('agentes_notas_fiscais').update({ ativo: false }).eq('empresa_id', empresaId).eq('ativo', true);
    if (error) throw new InternalServerErrorException(`Falha ao revogar token do agente: ${error.message}`);
  }

  async marcarUltimoUso(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('agentes_notas_fiscais').update({ ultimo_uso_em: new Date().toISOString() }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar último uso do agente: ${error.message}`);
  }

  private mapear(linha: Linha): AgenteNotasFiscais {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      ativo: linha.ativo,
      ultimoUsoEm: linha.ultimo_uso_em,
      criadoEm: linha.criado_em,
    };
  }
}
