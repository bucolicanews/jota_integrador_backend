import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { DadosIdentificadorExtrato, IdentificadorExtrato, IdentificadoresExtratoRepositorioPort } from '../aplicacao/portas/identificadores-extrato-repositorio.port';

interface Linha {
  id: string;
  empresa_id: string;
  descricao: string;
}

const COLUNAS = 'id, empresa_id, descricao';

@Injectable()
export class IdentificadoresExtratoRepositorioSupabase implements IdentificadoresExtratoRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosIdentificadorExtrato): Promise<IdentificadorExtrato> {
    const { data, error } = await this.supabase.admin
      .from('identificadores_extrato')
      .insert({ empresa_id: dados.empresaId, descricao: dados.descricao })
      .select(COLUNAS)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar identificador: ${error.message}`);
    return this.mapear(data as Linha);
  }

  async listarPorEmpresa(empresaId: string): Promise<IdentificadorExtrato[]> {
    const { data, error } = await this.supabase.admin.from('identificadores_extrato').select(COLUNAS).eq('empresa_id', empresaId).order('descricao');
    if (error) throw new InternalServerErrorException(`Falha ao listar identificadores: ${error.message}`);
    return (data as Linha[]).map((linha) => this.mapear(linha));
  }

  async obterPorId(id: string): Promise<IdentificadorExtrato | null> {
    const { data, error } = await this.supabase.admin.from('identificadores_extrato').select(COLUNAS).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar identificador: ${error.message}`);
    return data ? this.mapear(data as Linha) : null;
  }

  async atualizar(id: string, dados: Partial<DadosIdentificadorExtrato>): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.descricao !== undefined) campos.descricao = dados.descricao;
    const { error } = await this.supabase.admin.from('identificadores_extrato').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar identificador: ${error.message}`);
  }

  async excluir(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('identificadores_extrato').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir identificador: ${error.message}`);
  }

  private mapear(linha: Linha): IdentificadorExtrato {
    return { id: linha.id, empresaId: linha.empresa_id, descricao: linha.descricao };
  }
}
