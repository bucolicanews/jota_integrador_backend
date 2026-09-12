import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { Permissao, PermissoesRepositorioPort } from '../aplicacao/portas/permissoes-repositorio.port';

interface LinhaPermissao {
  id: string;
  recurso: string;
  acao: string;
  chave: string;
}

const COLUNAS_PERMISSAO = 'id, recurso, acao, chave';

@Injectable()
export class PermissoesRepositorioSupabase implements PermissoesRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async listarPermissoesDoPapel(papelId: string): Promise<Permissao[]> {
    const { data, error } = await this.supabase.admin
      .from('papel_permissoes')
      .select(`permissoes (${COLUNAS_PERMISSAO})`)
      .eq('papel_id', papelId);
    if (error) throw new InternalServerErrorException(`Falha ao listar permissões do papel: ${error.message}`);
    return (data as unknown as { permissoes: LinhaPermissao }[]).map((linha) => this.mapear(linha.permissoes));
  }

  async listarPermissoesDoUsuario(usuarioId: string): Promise<Permissao[]> {
    const { data, error } = await this.supabase.admin
      .from('usuario_permissoes')
      .select(`permissoes (${COLUNAS_PERMISSAO})`)
      .eq('usuario_id', usuarioId);
    if (error) throw new InternalServerErrorException(`Falha ao listar permissões do usuário: ${error.message}`);
    return (data as unknown as { permissoes: LinhaPermissao }[]).map((linha) => this.mapear(linha.permissoes));
  }

  async usuarioTemPermissao(usuarioId: string, chave: string): Promise<boolean> {
    const { count, error } = await this.supabase.admin
      .from('usuario_permissoes')
      .select('permissoes!inner(chave)', { count: 'exact', head: true })
      .eq('usuario_id', usuarioId)
      .eq('permissoes.chave', chave);
    if (error) throw new InternalServerErrorException(`Falha ao checar permissão: ${error.message}`);
    return (count ?? 0) > 0;
  }

  async buscarPermissaoPorId(id: string): Promise<Permissao | null> {
    const { data, error } = await this.supabase.admin.from('permissoes').select(COLUNAS_PERMISSAO).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar permissão: ${error.message}`);
    return data ? this.mapear(data as LinhaPermissao) : null;
  }

  async conceder(usuarioId: string, permissaoId: string, concedidoPorId: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('usuario_permissoes')
      .upsert({ usuario_id: usuarioId, permissao_id: permissaoId, concedido_por: concedidoPorId }, { onConflict: 'usuario_id, permissao_id' });
    if (error) throw new InternalServerErrorException(`Falha ao conceder permissão: ${error.message}`);
  }

  async revogar(usuarioId: string, permissaoId: string): Promise<void> {
    const { error } = await this.supabase.admin.from('usuario_permissoes').delete().eq('usuario_id', usuarioId).eq('permissao_id', permissaoId);
    if (error) throw new InternalServerErrorException(`Falha ao revogar permissão: ${error.message}`);
  }

  private mapear(linha: LinhaPermissao): Permissao {
    return { id: linha.id, recurso: linha.recurso, acao: linha.acao, chave: linha.chave };
  }
}
