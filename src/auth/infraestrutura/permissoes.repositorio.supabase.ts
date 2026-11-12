import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { InfoPapel } from '../dominio/papel';
import {
  DadosAtualizarPapel,
  DadosNovoPapel,
  FiltroDonoPapel,
  Permissao,
  PermissoesRepositorioPort,
} from '../aplicacao/portas/permissoes-repositorio.port';

interface LinhaPermissao {
  id: string;
  recurso: string;
  acao: string;
  chave: string;
}

interface LinhaPapel {
  id: string;
  nome: string;
  escopo: InfoPapel['escopo'];
  descricao: string | null;
  sistema: boolean;
  nunca_restringe: boolean;
  contador_id: string | null;
  empresa_id: string | null;
}

const COLUNAS_PERMISSAO = 'id, recurso, acao, chave';
const COLUNAS_PAPEL = 'id, nome, escopo, descricao, sistema, nunca_restringe, contador_id, empresa_id';

@Injectable()
export class PermissoesRepositorioSupabase implements PermissoesRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async listarPapeis(filtro: FiltroDonoPapel): Promise<InfoPapel[]> {
    let query = this.supabase.admin.from('papeis').select(COLUNAS_PAPEL);
    // Globais (contador_id/empresa_id ambos null) OU os do dono pedido -- nunca de outro dono.
    if (filtro.contadorId) {
      query = query.or(`and(contador_id.is.null,empresa_id.is.null),contador_id.eq.${filtro.contadorId}`);
    } else if (filtro.empresaId) {
      query = query.or(`and(contador_id.is.null,empresa_id.is.null),empresa_id.eq.${filtro.empresaId}`);
    } else {
      query = query.is('contador_id', null).is('empresa_id', null);
    }

    const { data, error } = await query.order('sistema', { ascending: false }).order('nome');
    if (error) throw new InternalServerErrorException(`Falha ao listar papéis: ${error.message}`);
    return (data as LinhaPapel[]).map((linha) => this.mapearPapel(linha));
  }

  async buscarPapelPorId(id: string): Promise<InfoPapel | null> {
    const { data, error } = await this.supabase.admin.from('papeis').select(COLUNAS_PAPEL).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar papel: ${error.message}`);
    return data ? this.mapearPapel(data as LinhaPapel) : null;
  }

  async criarPapel(dados: DadosNovoPapel): Promise<InfoPapel> {
    const { data, error } = await this.supabase.admin
      .from('papeis')
      .insert({
        nome: dados.nome,
        escopo: dados.escopo,
        descricao: dados.descricao,
        sistema: false,
        nunca_restringe: false,
        contador_id: dados.contadorId,
        empresa_id: dados.empresaId,
      })
      .select(COLUNAS_PAPEL)
      .single();
    if (error) {
      // 23505 = violação de um dos unique index parciais de papeis.nome (global/por contador/por empresa) -- conflito de negócio (409), não erro de infra.
      if (error.code === '23505') throw new ConflictException(`Já existe um papel com o nome "${dados.nome}"`);
      throw new InternalServerErrorException(`Falha ao criar papel: ${error.message}`);
    }

    const papel = this.mapearPapel(data as LinhaPapel);

    if (dados.permissaoIds.length > 0) {
      const linhas = dados.permissaoIds.map((permissaoId) => ({ papel_id: papel.id, permissao_id: permissaoId }));
      const { error: erroTeto } = await this.supabase.admin.from('papel_permissoes').insert(linhas);
      if (erroTeto) throw new InternalServerErrorException(`Falha ao gravar teto do papel: ${erroTeto.message}`);
    }

    return papel;
  }

  async atualizarPapel(id: string, dados: DadosAtualizarPapel): Promise<void> {
    const campos: Record<string, unknown> = { descricao: dados.descricao };
    if (dados.nome !== undefined) campos.nome = dados.nome;
    if (dados.escopo !== undefined) campos.escopo = dados.escopo;

    const { error: erroUpdate } = await this.supabase.admin.from('papeis').update(campos).eq('id', id);
    if (erroUpdate) {
      if (erroUpdate.code === '23505') throw new ConflictException(`Já existe um papel com o nome "${dados.nome}"`);
      throw new InternalServerErrorException(`Falha ao atualizar papel: ${erroUpdate.message}`);
    }

    const { error: erroDelete } = await this.supabase.admin.from('papel_permissoes').delete().eq('papel_id', id);
    if (erroDelete) throw new InternalServerErrorException(`Falha ao limpar teto do papel: ${erroDelete.message}`);

    if (dados.permissaoIds.length === 0) return;
    const linhas = dados.permissaoIds.map((permissaoId) => ({ papel_id: id, permissao_id: permissaoId }));
    const { error: erroInsert } = await this.supabase.admin.from('papel_permissoes').insert(linhas);
    if (erroInsert) throw new InternalServerErrorException(`Falha ao gravar teto do papel: ${erroInsert.message}`);
  }

  async deletarPapel(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('papeis').delete().eq('id', id);
    if (error) {
      // 23503 = FK de usuarios.papel_id -- rede de segurança se a contagem na apresentação já não tiver pego.
      if (error.code === '23503') throw new ConflictException('Papel em uso por usuário(s) -- reatribua antes de excluir.');
      throw new InternalServerErrorException(`Falha ao excluir papel: ${error.message}`);
    }
  }

  private mapearPapel(linha: LinhaPapel): InfoPapel {
    return {
      id: linha.id,
      nome: linha.nome,
      escopo: linha.escopo,
      descricao: linha.descricao,
      sistema: linha.sistema,
      nuncaRestringe: linha.nunca_restringe,
      contadorId: linha.contador_id,
      empresaId: linha.empresa_id,
    };
  }

  async listarPermissoesDoPapel(papelId: string): Promise<Permissao[]> {
    const { data, error } = await this.supabase.admin
      .from('papel_permissoes')
      .select(`permissoes (${COLUNAS_PERMISSAO})`)
      .eq('papel_id', papelId);
    if (error) throw new InternalServerErrorException(`Falha ao listar permissões do papel: ${error.message}`);
    return (data as unknown as { permissoes: LinhaPermissao }[]).map((linha) => this.mapear(linha.permissoes));
  }

  async listarCatalogoPermissoes(): Promise<Permissao[]> {
    const { data, error } = await this.supabase.admin.from('permissoes').select(COLUNAS_PERMISSAO).order('recurso').order('acao');
    if (error) throw new InternalServerErrorException(`Falha ao listar catálogo de permissões: ${error.message}`);
    return (data as LinhaPermissao[]).map((linha) => this.mapear(linha));
  }

  async obterTetoEfetivo(papelId: string, contadorId: string | null, empresaId: string | null): Promise<Permissao[]> {
    let query = this.supabase.admin.from('papel_permissoes_dono').select(`permissoes (${COLUNAS_PERMISSAO})`).eq('papel_id', papelId);
    query = contadorId
      ? query.eq('contador_id', contadorId)
      : empresaId
        ? query.eq('empresa_id', empresaId)
        : query.is('contador_id', null).is('empresa_id', null);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(`Falha ao obter teto por dono: ${error.message}`);
    const override = (data as unknown as { permissoes: LinhaPermissao }[]).map((linha) => this.mapear(linha.permissoes));
    if (override.length > 0) return override;
    return this.listarPermissoesDoPapel(papelId);
  }

  async definirTetoDono(papelId: string, contadorId: string | null, empresaId: string | null, permissaoIds: string[]): Promise<void> {
    let delQuery = this.supabase.admin.from('papel_permissoes_dono').delete().eq('papel_id', papelId);
    delQuery = contadorId
      ? delQuery.eq('contador_id', contadorId)
      : empresaId
        ? delQuery.eq('empresa_id', empresaId)
        : delQuery.is('contador_id', null).is('empresa_id', null);

    const { error: erroDelete } = await delQuery;
    if (erroDelete) throw new InternalServerErrorException(`Falha ao limpar teto por dono: ${erroDelete.message}`);
    if (permissaoIds.length === 0) return;

    const linhas = permissaoIds.map((permissaoId) => ({ papel_id: papelId, contador_id: contadorId, empresa_id: empresaId, permissao_id: permissaoId }));
    const { error: erroInsert } = await this.supabase.admin.from('papel_permissoes_dono').insert(linhas);
    if (erroInsert) throw new InternalServerErrorException(`Falha ao salvar teto por dono: ${erroInsert.message}`);
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
