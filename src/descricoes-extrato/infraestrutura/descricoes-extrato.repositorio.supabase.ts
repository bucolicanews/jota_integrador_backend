import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { DadosDescricaoExtrato, DescricaoExtrato, DescricoesExtratoRepositorioPort } from '../aplicacao/portas/descricoes-extrato-repositorio.port';

interface Linha {
  id: string;
  empresa_id: string;
  descricao: string;
}

const COLUNAS = 'id, empresa_id, descricao';

@Injectable()
export class DescricoesExtratoRepositorioSupabase implements DescricoesExtratoRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosDescricaoExtrato): Promise<DescricaoExtrato> {
    const { data, error } = await this.supabase.admin
      .from('descricoes_extrato')
      .insert({ empresa_id: dados.empresaId, descricao: dados.descricao })
      .select(COLUNAS)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar descrição: ${error.message}`);
    return this.mapear(data as Linha);
  }

  async listarPorEmpresa(empresaId: string): Promise<DescricaoExtrato[]> {
    const { data, error } = await this.supabase.admin.from('descricoes_extrato').select(COLUNAS).eq('empresa_id', empresaId).order('descricao');
    if (error) throw new InternalServerErrorException(`Falha ao listar descrições: ${error.message}`);
    return (data as Linha[]).map((linha) => this.mapear(linha));
  }

  async obterPorId(id: string): Promise<DescricaoExtrato | null> {
    const { data, error } = await this.supabase.admin.from('descricoes_extrato').select(COLUNAS).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar descrição: ${error.message}`);
    return data ? this.mapear(data as Linha) : null;
  }

  async atualizar(id: string, dados: Partial<DadosDescricaoExtrato>): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.descricao !== undefined) campos.descricao = dados.descricao;
    const { error } = await this.supabase.admin.from('descricoes_extrato').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar descrição: ${error.message}`);
  }

  async excluir(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('descricoes_extrato').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir descrição: ${error.message}`);
  }

  private mapear(linha: Linha): DescricaoExtrato {
    return { id: linha.id, empresaId: linha.empresa_id, descricao: linha.descricao };
  }
}
