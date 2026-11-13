import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  Coluna,
  DadosAtualizarColuna,
  DadosNovaColuna,
  QuadroComColunas,
  QuadroTarefas,
  QuadrosTarefasRepositorioPort,
} from '../aplicacao/portas/quadros-tarefas-repositorio.port';

interface LinhaQuadro {
  id: string;
  empresa_id: string;
  nome: string;
}

interface LinhaColuna {
  id: string;
  quadro_id: string;
  nome: string;
  ordem: number;
  eh_final: boolean;
}

const COLUNAS_QUADRO = 'id, empresa_id, nome';
const COLUNAS_COLUNA = 'id, quadro_id, nome, ordem, eh_final';

@Injectable()
export class QuadrosTarefasRepositorioSupabase implements QuadrosTarefasRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async listarPorEmpresa(empresaId: string): Promise<QuadroComColunas[]> {
    const { data, error } = await this.supabase.admin
      .from('quadros_tarefas')
      .select(COLUNAS_QUADRO)
      .eq('empresa_id', empresaId)
      .order('criado_em');
    if (error) throw new InternalServerErrorException(`Falha ao listar quadros: ${error.message}`);
    return this.comColunas((data as LinhaQuadro[]) ?? []);
  }

  async obterPorId(id: string): Promise<QuadroComColunas | null> {
    const { data, error } = await this.supabase.admin.from('quadros_tarefas').select(COLUNAS_QUADRO).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar quadro: ${error.message}`);
    if (!data) return null;
    const [quadro] = await this.comColunas([data as LinhaQuadro]);
    return quadro;
  }

  private async comColunas(linhas: LinhaQuadro[]): Promise<QuadroComColunas[]> {
    return Promise.all(
      linhas.map(async (linha) => ({
        id: linha.id,
        empresaId: linha.empresa_id,
        nome: linha.nome,
        colunas: await this.listarColunas(linha.id),
      })),
    );
  }

  async criar(empresaId: string, nome: string): Promise<QuadroTarefas> {
    const { data, error } = await this.supabase.admin
      .from('quadros_tarefas')
      .insert({ empresa_id: empresaId, nome })
      .select(COLUNAS_QUADRO)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar quadro: ${error.message}`);
    const linha = data as LinhaQuadro;
    return { id: linha.id, empresaId: linha.empresa_id, nome: linha.nome };
  }

  async atualizar(id: string, nome: string): Promise<void> {
    const { error } = await this.supabase.admin.from('quadros_tarefas').update({ nome }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao renomear quadro: ${error.message}`);
  }

  async excluir(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('quadros_tarefas').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir quadro: ${error.message}`);
  }

  async listarColunas(quadroId: string): Promise<Coluna[]> {
    const { data, error } = await this.supabase.admin
      .from('colunas_tarefas')
      .select(COLUNAS_COLUNA)
      .eq('quadro_id', quadroId)
      .order('ordem');
    if (error) throw new InternalServerErrorException(`Falha ao listar colunas: ${error.message}`);
    return (data as LinhaColuna[]).map((linha) => this.mapearColuna(linha));
  }

  async criarColuna(dados: DadosNovaColuna): Promise<Coluna> {
    const { data, error } = await this.supabase.admin
      .from('colunas_tarefas')
      .insert({ quadro_id: dados.quadroId, nome: dados.nome, ordem: dados.ordem, eh_final: dados.ehFinal })
      .select(COLUNAS_COLUNA)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar coluna: ${error.message}`);
    return this.mapearColuna(data as LinhaColuna);
  }

  async atualizarColuna(id: string, dados: DadosAtualizarColuna): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.nome !== undefined) campos.nome = dados.nome;
    if (dados.ehFinal !== undefined) campos.eh_final = dados.ehFinal;

    const { error } = await this.supabase.admin.from('colunas_tarefas').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar coluna: ${error.message}`);
  }

  async reordenarColunas(ordens: { id: string; ordem: number }[]): Promise<void> {
    for (const { id, ordem } of ordens) {
      const { error } = await this.supabase.admin.from('colunas_tarefas').update({ ordem }).eq('id', id);
      if (error) throw new InternalServerErrorException(`Falha ao reordenar coluna: ${error.message}`);
    }
  }

  async excluirColuna(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('colunas_tarefas').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir coluna: ${error.message}`);
  }

  async obterColunaPorId(id: string): Promise<Coluna | null> {
    const { data, error } = await this.supabase.admin.from('colunas_tarefas').select(COLUNAS_COLUNA).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar coluna: ${error.message}`);
    return data ? this.mapearColuna(data as LinhaColuna) : null;
  }

  private mapearColuna(linha: LinhaColuna): Coluna {
    return {
      id: linha.id,
      quadroId: linha.quadro_id,
      nome: linha.nome,
      ordem: linha.ordem,
      ehFinal: linha.eh_final,
    };
  }
}
