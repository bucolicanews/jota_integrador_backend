import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { InfoPapel, Papel } from '../dominio/papel';
import { FiltroDonoPapel } from '../aplicacao/portas/permissoes-repositorio.port';
import {
  DadosNovoUsuario,
  Usuario,
  UsuariosRepositorioPort,
} from '../aplicacao/portas/usuarios-repositorio.port';

interface LinhaUsuario {
  id: string;
  nome: string;
  email: string;
  contador_id: string | null;
  empresa_id: string | null;
  mfa_habilitado: boolean;
  status: 'ativo' | 'inativo';
  bloqueado: boolean;
  avatar_ref: string | null;
  papeis: { nome: Papel } | { nome: Papel }[] | null;
}

const COLUNAS_SELECT = 'id, nome, email, contador_id, empresa_id, mfa_habilitado, status, bloqueado, avatar_ref, papeis(nome)';

@Injectable()
export class UsuariosRepositorioSupabase implements UsuariosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoUsuario): Promise<Usuario> {
    // Nunca `.insert({...body})` -- lista explícita de campos (regra de mass assignment,
    // ver PENTEST_CODE_REVIEW_PROTOCOL.md do vault e a auditoria já feita no DeliveryHub).
    const { data, error } = await this.supabase.admin
      .from('usuarios')
      .insert({
        id: dados.id,
        nome: dados.nome,
        email: dados.email,
        papel_id: dados.papelId,
        contador_id: dados.contadorId,
        empresa_id: dados.empresaId,
      })
      .select(COLUNAS_SELECT)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar perfil de usuário: ${error?.message}`);
    }

    return this.mapear(data as unknown as LinhaUsuario);
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    const { data, error } = await this.supabase.admin
      .from('usuarios')
      .select(COLUNAS_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar usuário: ${error.message}`);
    }
    if (!data) {
      return null;
    }

    return this.mapear(data as unknown as LinhaUsuario);
  }

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const { data, error } = await this.supabase.admin
      .from('usuarios')
      .select(COLUNAS_SELECT)
      .eq('email', email)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar usuário por e-mail: ${error.message}`);
    }
    if (!data) {
      return null;
    }

    return this.mapear(data as unknown as LinhaUsuario);
  }

  async atualizarPapelEVinculo(
    id: string,
    papelId: string,
    contadorId: string | null,
    empresaId: string | null,
  ): Promise<void> {
    const { error } = await this.supabase.admin
      .from('usuarios')
      .update({ papel_id: papelId, contador_id: contadorId, empresa_id: empresaId })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar papel/vínculo: ${error.message}`);
    }
  }

  async marcarBloqueio(
    id: string,
    bloqueado: boolean,
    motivo: string | null,
    executadoPorId: string,
  ): Promise<void> {
    const { error } = await this.supabase.admin
      .from('usuarios')
      .update({
        bloqueado,
        bloqueado_em: bloqueado ? new Date().toISOString() : null,
        bloqueado_motivo: bloqueado ? motivo : null,
        bloqueado_por: bloqueado ? executadoPorId : null,
      })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao alterar bloqueio: ${error.message}`);
    }
  }

  async atualizarNome(id: string, nome: string): Promise<void> {
    const { error } = await this.supabase.admin.from('usuarios').update({ nome }).eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar nome: ${error.message}`);
    }
  }

  async atualizarEmail(id: string, email: string): Promise<void> {
    const { error } = await this.supabase.admin.from('usuarios').update({ email }).eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar e-mail: ${error.message}`);
    }
  }

  async atualizarAvatarRef(id: string, avatarRef: string | null): Promise<void> {
    const { error } = await this.supabase.admin.from('usuarios').update({ avatar_ref: avatarRef }).eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar foto de perfil: ${error.message}`);
    }
  }

  async listar(filtro: { contadorId: string | null; empresaIds: string[]; plataforma?: boolean }): Promise<Usuario[]> {
    let consulta = this.supabase.admin
      .from('usuarios')
      .select(COLUNAS_SELECT)
      .order('nome', { ascending: true });

    if (filtro.contadorId && filtro.empresaIds.length > 0) {
      consulta = consulta.or(`contador_id.eq.${filtro.contadorId},empresa_id.in.(${filtro.empresaIds.join(',')})`);
    } else if (filtro.contadorId) {
      consulta = consulta.eq('contador_id', filtro.contadorId);
    } else if (filtro.empresaIds.length > 0) {
      consulta = consulta.in('empresa_id', filtro.empresaIds);
    } else if (filtro.plataforma) {
      consulta = consulta.is('contador_id', null).is('empresa_id', null);
    } else {
      return [];
    }

    const { data, error } = await consulta;

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar usuários: ${error.message}`);
    }

    return (data as unknown as LinhaUsuario[]).map((linha) => this.mapear(linha));
  }

  async buscarIdPapelPorNome(nomePapel: Papel): Promise<string> {
    // Só papel GLOBAL -- os 3 call sites de hoje (teto por dono) só tratam papel de
    // sistema restringível (sempre contador_id/empresa_id null). Filtrar global explícito
    // evita colidir com um papel customizado de outro dono que reuse o mesmo nome.
    const { data, error } = await this.supabase.admin
      .from('papeis')
      .select('id')
      .eq('nome', nomePapel)
      .is('contador_id', null)
      .is('empresa_id', null)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Papel ${nomePapel} não encontrado no catálogo`);
    }

    return (data as { id: string }).id;
  }

  async buscarPapelPorNome(nomePapel: Papel, filtro: FiltroDonoPapel): Promise<InfoPapel> {
    let query = this.supabase.admin.from('papeis').select('id, nome, escopo, descricao, sistema, nunca_restringe, contador_id, empresa_id').eq('nome', nomePapel);
    // Global OU do dono informado -- nunca de outro dono (nome não é mais único global).
    if (filtro.contadorId) {
      query = query.or(`and(contador_id.is.null,empresa_id.is.null),contador_id.eq.${filtro.contadorId}`);
    } else if (filtro.empresaId) {
      query = query.or(`and(contador_id.is.null,empresa_id.is.null),empresa_id.eq.${filtro.empresaId}`);
    } else {
      query = query.is('contador_id', null).is('empresa_id', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Papel ${nomePapel} não encontrado no catálogo`);
    }

    const linha = data as {
      id: string;
      nome: string;
      escopo: InfoPapel['escopo'];
      descricao: string | null;
      sistema: boolean;
      nunca_restringe: boolean;
      contador_id: string | null;
      empresa_id: string | null;
    };
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

  private mapear(linha: LinhaUsuario): Usuario {
    const papelRelacionado = Array.isArray(linha.papeis) ? linha.papeis[0] : linha.papeis;
    if (!papelRelacionado) {
      throw new InternalServerErrorException(`Usuário ${linha.id} sem papel associado`);
    }

    return {
      id: linha.id,
      nome: linha.nome,
      email: linha.email,
      papel: papelRelacionado.nome,
      contadorId: linha.contador_id,
      empresaId: linha.empresa_id,
      mfaHabilitado: linha.mfa_habilitado,
      status: linha.status,
      bloqueado: linha.bloqueado,
      avatarUrl: linha.avatar_ref,
    };
  }
}
