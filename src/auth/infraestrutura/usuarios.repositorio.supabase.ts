import { createHash } from 'crypto';
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { InfoPapel, Papel } from '../dominio/papel';
import { Metodo2FA } from '../aplicacao/portas/provedor-identidade.port';
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
  metodo_2fa: Metodo2FA;
  status: 'ativo' | 'inativo';
  bloqueado: boolean;
  bloqueio_automatico_ate: string | null;
  avatar_ref: string | null;
  papeis: { nome: Papel } | { nome: Papel }[] | null;
}

const COLUNAS_SELECT =
  'id, nome, email, contador_id, empresa_id, metodo_2fa, status, bloqueado, bloqueio_automatico_ate, avatar_ref, papeis(nome)';

// Código de 2FA por email é curto-prazo (TTL minutos) e de 6 dígitos -- hash simples
// (sem segredo HMAC, diferente de PII real) só pra não ficar texto puro em repouso;
// comparação sempre contra o hash, nunca guarda o código em claro.
const hashCodigo2fa = (codigo: string) => createHash('sha256').update(codigo).digest('hex');
const MAX_TENTATIVAS_CODIGO_2FA = 5;

// Mesmo limite documentado no comentário de AuthLoginService do DeliveryHub (referência
// cross-project já validada) -- 5 tentativas, 5 minutos de lockout.
const MAX_TENTATIVAS_LOGIN_FALHAS = 5;
const DURACAO_BLOQUEIO_AUTOMATICO_MS = 5 * 60 * 1000;

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

  async contarUsuariosComPapel(papelId: string): Promise<number> {
    const { count, error } = await this.supabase.admin
      .from('usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('papel_id', papelId);

    if (error) {
      throw new InternalServerErrorException(`Falha ao contar usuários do papel: ${error.message}`);
    }
    return count ?? 0;
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

  async atualizarMetodo2fa(id: string, metodo: Metodo2FA): Promise<void> {
    const { error } = await this.supabase.admin.from('usuarios').update({ metodo_2fa: metodo }).eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar método de 2FA: ${error.message}`);
    }
  }

  async salvarCodigoEmail2fa(id: string, codigo: string, ttlMs: number): Promise<void> {
    const { error } = await this.supabase.admin
      .from('usuarios')
      .update({
        email_2fa_codigo_hash: hashCodigo2fa(codigo),
        email_2fa_codigo_expira_em: new Date(Date.now() + ttlMs).toISOString(),
        email_2fa_tentativas: 0,
      })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao salvar código de 2FA por email: ${error.message}`);
    }
  }

  async verificarCodigoEmail2fa(id: string, codigo: string): Promise<'valido' | 'invalido' | 'expirado' | 'muitas_tentativas'> {
    const { data, error } = await this.supabase.admin
      .from('usuarios')
      .select('email_2fa_codigo_hash, email_2fa_codigo_expira_em, email_2fa_tentativas')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(`Falha ao ler código de 2FA por email: ${error.message}`);
    }

    const linha = data as { email_2fa_codigo_hash: string | null; email_2fa_codigo_expira_em: string | null; email_2fa_tentativas: number } | null;
    if (!linha?.email_2fa_codigo_hash || !linha.email_2fa_codigo_expira_em) {
      return 'invalido';
    }

    if (linha.email_2fa_tentativas >= MAX_TENTATIVAS_CODIGO_2FA) {
      return 'muitas_tentativas';
    }

    // Sempre incrementa ANTES de checar o resultado -- cada chamada consome uma
    // tentativa, acerto ou erro, senão o limite nunca é alcançado por tentativa errada.
    const { error: erroIncremento } = await this.supabase.admin
      .from('usuarios')
      .update({ email_2fa_tentativas: linha.email_2fa_tentativas + 1 })
      .eq('id', id);
    if (erroIncremento) {
      throw new InternalServerErrorException(`Falha ao registrar tentativa de 2FA por email: ${erroIncremento.message}`);
    }

    if (new Date(linha.email_2fa_codigo_expira_em).getTime() < Date.now()) {
      return 'expirado';
    }

    if (hashCodigo2fa(codigo) !== linha.email_2fa_codigo_hash) {
      return 'invalido';
    }

    // Código consumido -- nunca reutilizável, mesmo dentro do TTL.
    const { error: erroLimpeza } = await this.supabase.admin
      .from('usuarios')
      .update({ email_2fa_codigo_hash: null, email_2fa_codigo_expira_em: null, email_2fa_tentativas: 0 })
      .eq('id', id);
    if (erroLimpeza) {
      throw new InternalServerErrorException(`Falha ao limpar código de 2FA por email: ${erroLimpeza.message}`);
    }

    return 'valido';
  }

  async registrarTentativaLogin(id: string, sucesso: boolean): Promise<string | null> {
    if (sucesso) {
      const { error } = await this.supabase.admin
        .from('usuarios')
        .update({ tentativas_login_falhas: 0, bloqueio_automatico_ate: null })
        .eq('id', id);
      if (error) {
        throw new InternalServerErrorException(`Falha ao zerar tentativas de login: ${error.message}`);
      }
      return null;
    }

    const { data, error } = await this.supabase.admin
      .from('usuarios')
      .select('tentativas_login_falhas')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(`Falha ao ler tentativas de login: ${error.message}`);
    }
    // Usuário sem perfil em `usuarios` (ex: identidade órfã do provedor) -- nada pra
    // contar, quem chama decide o que fazer (hook não pode travar login de ninguém fora
    // da nossa tabela por conta disso).
    if (!data) return null;

    const novasTentativas = (data as { tentativas_login_falhas: number }).tentativas_login_falhas + 1;
    const atingiuLimite = novasTentativas >= MAX_TENTATIVAS_LOGIN_FALHAS;
    const bloqueioAutomaticoAte = atingiuLimite ? new Date(Date.now() + DURACAO_BLOQUEIO_AUTOMATICO_MS).toISOString() : null;

    const { error: erroUpdate } = await this.supabase.admin
      .from('usuarios')
      .update({
        tentativas_login_falhas: atingiuLimite ? 0 : novasTentativas,
        bloqueio_automatico_ate: bloqueioAutomaticoAte,
      })
      .eq('id', id);
    if (erroUpdate) {
      throw new InternalServerErrorException(`Falha ao registrar tentativa de login: ${erroUpdate.message}`);
    }

    return bloqueioAutomaticoAte;
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

  async buscarInfoPapelDoUsuario(usuarioId: string): Promise<InfoPapel> {
    const { data, error } = await this.supabase.admin
      .from('usuarios')
      .select('papeis(id, nome, escopo, descricao, sistema, nunca_restringe, contador_id, empresa_id)')
      .eq('id', usuarioId)
      .maybeSingle();

    const linha = data as { papeis: InfoPapel | { id: string; nome: Papel; escopo: InfoPapel['escopo']; descricao: string | null; sistema: boolean; nunca_restringe: boolean; contador_id: string | null; empresa_id: string | null } | null } | null;
    const papelRelacionado = linha?.papeis;
    if (error || !papelRelacionado) {
      throw new NotFoundException(`Usuário ${usuarioId} sem papel associado`);
    }

    const bruto = papelRelacionado as unknown as {
      id: string;
      nome: Papel;
      escopo: InfoPapel['escopo'];
      descricao: string | null;
      sistema: boolean;
      nunca_restringe: boolean;
      contador_id: string | null;
      empresa_id: string | null;
    };
    return {
      id: bruto.id,
      nome: bruto.nome,
      escopo: bruto.escopo,
      descricao: bruto.descricao,
      sistema: bruto.sistema,
      nuncaRestringe: bruto.nunca_restringe,
      contadorId: bruto.contador_id,
      empresaId: bruto.empresa_id,
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
      metodo2fa: linha.metodo_2fa,
      status: linha.status,
      bloqueado: linha.bloqueado,
      bloqueioAutomaticoAte: linha.bloqueio_automatico_ate,
      avatarUrl: linha.avatar_ref,
    };
  }
}
