import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { DadosHistorico, Historico, HistoricosRepositorioPort } from '../aplicacao/portas/historicos-repositorio.port';

interface Linha {
  id: string;
  empresa_id: string;
  codigo: string | null;
  descricao: string;
}

const COLUNAS = 'id, empresa_id, codigo, descricao';

@Injectable()
export class HistoricosRepositorioSupabase implements HistoricosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosHistorico): Promise<Historico> {
    const { data, error } = await this.supabase.admin
      .from('historicos')
      .insert({ empresa_id: dados.empresaId, codigo: dados.codigo ?? null, descricao: dados.descricao })
      .select(COLUNAS)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar histórico: ${error.message}`);
    return this.mapear(data as Linha);
  }

  async listarPorEmpresa(empresaId: string): Promise<Historico[]> {
    const { data, error } = await this.supabase.admin
      .from('historicos')
      .select(COLUNAS)
      .eq('empresa_id', empresaId)
      .order('descricao');
    if (error) throw new InternalServerErrorException(`Falha ao listar históricos: ${error.message}`);
    return (data as Linha[]).map((linha) => this.mapear(linha));
  }

  async obterPorId(id: string): Promise<Historico | null> {
    const { data, error } = await this.supabase.admin.from('historicos').select(COLUNAS).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar histórico: ${error.message}`);
    return data ? this.mapear(data as Linha) : null;
  }

  async atualizar(id: string, dados: Partial<DadosHistorico>): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.codigo !== undefined) campos.codigo = dados.codigo;
    if (dados.descricao !== undefined) campos.descricao = dados.descricao;

    const { error } = await this.supabase.admin.from('historicos').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar histórico: ${error.message}`);
  }

  async excluir(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('historicos').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir histórico: ${error.message}`);
  }

  private mapear(linha: Linha): Historico {
    return { id: linha.id, empresaId: linha.empresa_id, codigo: linha.codigo, descricao: linha.descricao };
  }
}
