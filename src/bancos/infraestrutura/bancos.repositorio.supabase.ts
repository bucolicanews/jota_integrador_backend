import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { Banco, BancosRepositorioPort, DadosBanco, TipoBanco } from '../aplicacao/portas/bancos-repositorio.port';

interface Linha {
  id: string;
  empresa_id: string;
  nome: string;
  conta_contabil_id: string;
  tipo: TipoBanco;
  ativo: boolean;
}

const COLUNAS = 'id, empresa_id, nome, conta_contabil_id, tipo, ativo';

@Injectable()
export class BancosRepositorioSupabase implements BancosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosBanco): Promise<Banco> {
    const { data, error } = await this.supabase.admin
      .from('bancos')
      .insert({ empresa_id: dados.empresaId, nome: dados.nome, conta_contabil_id: dados.contaContabilId, tipo: dados.tipo })
      .select(COLUNAS)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar banco: ${error.message}`);
    return this.mapear(data as Linha);
  }

  async listarPorEmpresa(empresaId: string, apenasAtivos?: boolean, tipo?: TipoBanco): Promise<Banco[]> {
    let query = this.supabase.admin.from('bancos').select(COLUNAS).eq('empresa_id', empresaId).order('nome');
    if (apenasAtivos) query = query.eq('ativo', true);
    if (tipo) query = query.eq('tipo', tipo);
    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(`Falha ao listar bancos: ${error.message}`);
    return (data as Linha[]).map((linha) => this.mapear(linha));
  }

  async obterPorId(id: string): Promise<Banco | null> {
    const { data, error } = await this.supabase.admin.from('bancos').select(COLUNAS).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar banco: ${error.message}`);
    return data ? this.mapear(data as Linha) : null;
  }

  async atualizar(id: string, dados: Partial<Pick<DadosBanco, 'nome' | 'contaContabilId' | 'tipo'>>): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.nome !== undefined) campos.nome = dados.nome;
    if (dados.contaContabilId !== undefined) campos.conta_contabil_id = dados.contaContabilId;
    if (dados.tipo !== undefined) campos.tipo = dados.tipo;

    const { error } = await this.supabase.admin.from('bancos').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar banco: ${error.message}`);
  }

  async marcarAtivo(id: string, ativo: boolean): Promise<void> {
    const { error } = await this.supabase.admin.from('bancos').update({ ativo }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar status do banco: ${error.message}`);
  }

  private mapear(linha: Linha): Banco {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      nome: linha.nome,
      contaContabilId: linha.conta_contabil_id,
      tipo: linha.tipo,
      ativo: linha.ativo,
    };
  }
}
