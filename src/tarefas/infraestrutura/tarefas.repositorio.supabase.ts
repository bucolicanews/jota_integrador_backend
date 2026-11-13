import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  AnexoTarefa,
  AtribuicaoHistorico,
  ComentarioTarefa,
  DadosAtualizarTarefa,
  DadosNovaTarefa,
  MembroEquipeTarefa,
  MovimentoHistorico,
  PrioridadeTarefa,
  Tarefa,
  TarefasRepositorioPort,
} from '../aplicacao/portas/tarefas-repositorio.port';

interface LinhaTarefa {
  id: string;
  empresa_id: string;
  quadro_id: string;
  coluna_id: string;
  titulo: string;
  descricao: string | null;
  criado_por: string;
  atribuido_a: string | null;
  prioridade: PrioridadeTarefa;
  prazo: string | null;
  tempo_estimado_horas: string | null; // numeric volta como string no driver
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

interface LinhaHistorico {
  id: string;
  tarefa_id: string;
  coluna_origem_id: string | null;
  coluna_destino_id: string;
  movido_por: string;
  responsavel_id: string | null;
  criado_em: string;
}

interface LinhaComentario {
  id: string;
  tarefa_id: string;
  autor_id: string;
  corpo: string;
  criado_em: string;
}

interface LinhaAnexo {
  id: string;
  tarefa_id: string;
  nome_arquivo: string;
  storage_ref: string;
  criado_por: string;
  criado_em: string;
}

interface LinhaAtribuicaoHistorico {
  id: string;
  tarefa_id: string;
  de_usuario_id: string | null;
  para_usuario_id: string | null;
  atribuido_por: string;
  criado_em: string;
}

interface LinhaMembroEquipe {
  id: string;
  tarefa_id: string;
  usuario_id: string;
  adicionado_por: string;
  criado_em: string;
}

const COLUNAS_TAREFA =
  'id, empresa_id, quadro_id, coluna_id, titulo, descricao, criado_por, atribuido_a, prioridade, prazo, tempo_estimado_horas, ordem, criado_em, atualizado_em';
const COLUNAS_HISTORICO = 'id, tarefa_id, coluna_origem_id, coluna_destino_id, movido_por, responsavel_id, criado_em';
const COLUNAS_ANEXO = 'id, tarefa_id, nome_arquivo, storage_ref, criado_por, criado_em';
const COLUNAS_COMENTARIO = 'id, tarefa_id, autor_id, corpo, criado_em';
const COLUNAS_ATRIBUICAO_HISTORICO = 'id, tarefa_id, de_usuario_id, para_usuario_id, atribuido_por, criado_em';
const COLUNAS_MEMBRO_EQUIPE = 'id, tarefa_id, usuario_id, adicionado_por, criado_em';

@Injectable()
export class TarefasRepositorioSupabase implements TarefasRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovaTarefa): Promise<Tarefa> {
    const { data, error } = await this.supabase.admin
      .from('tarefas')
      .insert({
        empresa_id: dados.empresaId,
        quadro_id: dados.quadroId,
        coluna_id: dados.colunaId,
        titulo: dados.titulo,
        descricao: dados.descricao,
        criado_por: dados.criadoPor,
        atribuido_a: dados.atribuidoA,
        prioridade: dados.prioridade,
        prazo: dados.prazo,
        tempo_estimado_horas: dados.tempoEstimadoHoras,
        ordem: dados.ordem,
      })
      .select(COLUNAS_TAREFA)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar tarefa: ${error.message}`);
    return this.mapear(data as LinhaTarefa);
  }

  async listarPorEmpresa(empresaId: string): Promise<Tarefa[]> {
    const { data, error } = await this.supabase.admin
      .from('tarefas')
      .select(COLUNAS_TAREFA)
      .eq('empresa_id', empresaId)
      .order('ordem');
    if (error) throw new InternalServerErrorException(`Falha ao listar tarefas: ${error.message}`);
    return (data as LinhaTarefa[]).map((linha) => this.mapear(linha));
  }

  async obterPorId(id: string): Promise<Tarefa | null> {
    const { data, error } = await this.supabase.admin.from('tarefas').select(COLUNAS_TAREFA).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar tarefa: ${error.message}`);
    return data ? this.mapear(data as LinhaTarefa) : null;
  }

  async atualizar(id: string, dados: DadosAtualizarTarefa): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.titulo !== undefined) campos.titulo = dados.titulo;
    if (dados.descricao !== undefined) campos.descricao = dados.descricao;
    if (dados.atribuidoA !== undefined) campos.atribuido_a = dados.atribuidoA;
    if (dados.prioridade !== undefined) campos.prioridade = dados.prioridade;
    if (dados.prazo !== undefined) campos.prazo = dados.prazo;
    if (dados.tempoEstimadoHoras !== undefined) campos.tempo_estimado_horas = dados.tempoEstimadoHoras;

    const { error } = await this.supabase.admin.from('tarefas').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar tarefa: ${error.message}`);
  }

  async mover(id: string, quadroId: string, colunaId: string, ordem: number): Promise<void> {
    const { error } = await this.supabase.admin
      .from('tarefas')
      .update({ quadro_id: quadroId, coluna_id: colunaId, ordem })
      .eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao mover tarefa: ${error.message}`);
  }

  async excluir(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('tarefas').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir tarefa: ${error.message}`);
  }

  async contarPorColuna(colunaId: string): Promise<number> {
    const { count, error } = await this.supabase.admin
      .from('tarefas')
      .select('id', { count: 'exact', head: true })
      .eq('coluna_id', colunaId);
    if (error) throw new InternalServerErrorException(`Falha ao contar tarefas da coluna: ${error.message}`);
    return count ?? 0;
  }

  async contarPorQuadro(quadroId: string): Promise<number> {
    const { count, error } = await this.supabase.admin
      .from('tarefas')
      .select('id', { count: 'exact', head: true })
      .eq('quadro_id', quadroId);
    if (error) throw new InternalServerErrorException(`Falha ao contar tarefas do quadro: ${error.message}`);
    return count ?? 0;
  }

  async registrarMovimento(dados: {
    tarefaId: string;
    colunaOrigemId: string | null;
    colunaDestinoId: string;
    movidoPor: string;
    responsavelId: string | null;
  }): Promise<void> {
    const { error } = await this.supabase.admin.from('tarefas_historico').insert({
      tarefa_id: dados.tarefaId,
      coluna_origem_id: dados.colunaOrigemId,
      coluna_destino_id: dados.colunaDestinoId,
      movido_por: dados.movidoPor,
      responsavel_id: dados.responsavelId,
    });
    if (error) throw new InternalServerErrorException(`Falha ao registrar movimento: ${error.message}`);
  }

  async listarHistorico(tarefaId: string): Promise<MovimentoHistorico[]> {
    const { data, error } = await this.supabase.admin
      .from('tarefas_historico')
      .select(COLUNAS_HISTORICO)
      .eq('tarefa_id', tarefaId)
      .order('criado_em');
    if (error) throw new InternalServerErrorException(`Falha ao listar histórico: ${error.message}`);
    return (data as LinhaHistorico[]).map((linha) => this.mapearHistorico(linha));
  }

  async listarHistoricoPorEmpresa(empresaId: string): Promise<MovimentoHistorico[]> {
    const { data, error } = await this.supabase.admin
      .from('tarefas_historico')
      .select(`${COLUNAS_HISTORICO}, tarefas!inner(empresa_id)`)
      .eq('tarefas.empresa_id', empresaId)
      .order('criado_em', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao listar histórico da empresa: ${error.message}`);
    return (data as unknown as LinhaHistorico[]).map((linha) => this.mapearHistorico(linha));
  }

  async criarComentario(tarefaId: string, autorId: string, corpo: string): Promise<ComentarioTarefa> {
    const { data, error } = await this.supabase.admin
      .from('tarefas_comentarios')
      .insert({ tarefa_id: tarefaId, autor_id: autorId, corpo })
      .select(COLUNAS_COMENTARIO)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar comentário: ${error.message}`);
    return this.mapearComentario(data as LinhaComentario);
  }

  async listarComentarios(tarefaId: string): Promise<ComentarioTarefa[]> {
    const { data, error } = await this.supabase.admin
      .from('tarefas_comentarios')
      .select(COLUNAS_COMENTARIO)
      .eq('tarefa_id', tarefaId)
      .order('criado_em');
    if (error) throw new InternalServerErrorException(`Falha ao listar comentários: ${error.message}`);
    return (data as LinhaComentario[]).map((linha) => this.mapearComentario(linha));
  }

  async listarComentariosPorEmpresa(empresaId: string): Promise<ComentarioTarefa[]> {
    const { data, error } = await this.supabase.admin
      .from('tarefas_comentarios')
      .select(`${COLUNAS_COMENTARIO}, tarefas!inner(empresa_id)`)
      .eq('tarefas.empresa_id', empresaId)
      .order('criado_em', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao listar comentários da empresa: ${error.message}`);
    return (data as unknown as LinhaComentario[]).map((linha) => this.mapearComentario(linha));
  }

  async obterComentarioPorId(id: string): Promise<ComentarioTarefa | null> {
    const { data, error } = await this.supabase.admin
      .from('tarefas_comentarios')
      .select(COLUNAS_COMENTARIO)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar comentário: ${error.message}`);
    return data ? this.mapearComentario(data as LinhaComentario) : null;
  }

  async atualizarComentario(id: string, corpo: string): Promise<void> {
    const { error } = await this.supabase.admin.from('tarefas_comentarios').update({ corpo }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar comentário: ${error.message}`);
  }

  async excluirComentario(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('tarefas_comentarios').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir comentário: ${error.message}`);
  }

  async adicionarAnexo(tarefaId: string, nomeArquivo: string, storageRef: string, criadoPor: string): Promise<AnexoTarefa> {
    const { data, error } = await this.supabase.admin
      .from('tarefas_anexos')
      .insert({ tarefa_id: tarefaId, nome_arquivo: nomeArquivo, storage_ref: storageRef, criado_por: criadoPor })
      .select(COLUNAS_ANEXO)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao registrar anexo: ${error.message}`);
    return this.mapearAnexo(data as LinhaAnexo);
  }

  async listarAnexos(tarefaId: string): Promise<AnexoTarefa[]> {
    const { data, error } = await this.supabase.admin
      .from('tarefas_anexos')
      .select(COLUNAS_ANEXO)
      .eq('tarefa_id', tarefaId)
      .order('criado_em');
    if (error) throw new InternalServerErrorException(`Falha ao listar anexos: ${error.message}`);
    return (data as LinhaAnexo[]).map((linha) => this.mapearAnexo(linha));
  }

  async obterAnexo(id: string): Promise<AnexoTarefa | null> {
    const { data, error } = await this.supabase.admin.from('tarefas_anexos').select(COLUNAS_ANEXO).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar anexo: ${error.message}`);
    return data ? this.mapearAnexo(data as LinhaAnexo) : null;
  }

  async listarAnexosPorEmpresa(empresaId: string): Promise<AnexoTarefa[]> {
    const { data, error } = await this.supabase.admin
      .from('tarefas_anexos')
      .select(`${COLUNAS_ANEXO}, tarefas!inner(empresa_id)`)
      .eq('tarefas.empresa_id', empresaId)
      .order('criado_em', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao listar anexos da empresa: ${error.message}`);
    return (data as unknown as LinhaAnexo[]).map((linha) => this.mapearAnexo(linha));
  }

  async registrarAtribuicao(dados: {
    tarefaId: string;
    deUsuarioId: string | null;
    paraUsuarioId: string | null;
    atribuidoPor: string;
  }): Promise<void> {
    const { error } = await this.supabase.admin.from('tarefas_atribuicoes_historico').insert({
      tarefa_id: dados.tarefaId,
      de_usuario_id: dados.deUsuarioId,
      para_usuario_id: dados.paraUsuarioId,
      atribuido_por: dados.atribuidoPor,
    });
    if (error) throw new InternalServerErrorException(`Falha ao registrar atribuição: ${error.message}`);
  }

  async listarAtribuicoesPorEmpresa(empresaId: string): Promise<AtribuicaoHistorico[]> {
    const { data, error } = await this.supabase.admin
      .from('tarefas_atribuicoes_historico')
      .select(`${COLUNAS_ATRIBUICAO_HISTORICO}, tarefas!inner(empresa_id)`)
      .eq('tarefas.empresa_id', empresaId)
      .order('criado_em', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao listar atribuições da empresa: ${error.message}`);
    return (data as unknown as LinhaAtribuicaoHistorico[]).map((linha) => this.mapearAtribuicaoHistorico(linha));
  }

  async adicionarMembroEquipe(tarefaId: string, usuarioId: string, adicionadoPor: string): Promise<MembroEquipeTarefa> {
    const { data, error } = await this.supabase.admin
      .from('tarefas_equipe')
      .insert({ tarefa_id: tarefaId, usuario_id: usuarioId, adicionado_por: adicionadoPor })
      .select(COLUNAS_MEMBRO_EQUIPE)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao adicionar membro à equipe: ${error.message}`);
    return this.mapearMembroEquipe(data as LinhaMembroEquipe);
  }

  async removerMembroEquipe(tarefaId: string, usuarioId: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('tarefas_equipe')
      .delete()
      .eq('tarefa_id', tarefaId)
      .eq('usuario_id', usuarioId);
    if (error) throw new InternalServerErrorException(`Falha ao remover membro da equipe: ${error.message}`);
  }

  async listarEquipe(tarefaId: string): Promise<MembroEquipeTarefa[]> {
    const { data, error } = await this.supabase.admin
      .from('tarefas_equipe')
      .select(COLUNAS_MEMBRO_EQUIPE)
      .eq('tarefa_id', tarefaId)
      .order('criado_em');
    if (error) throw new InternalServerErrorException(`Falha ao listar equipe: ${error.message}`);
    return (data as LinhaMembroEquipe[]).map((linha) => this.mapearMembroEquipe(linha));
  }

  private mapear(linha: LinhaTarefa): Tarefa {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      quadroId: linha.quadro_id,
      colunaId: linha.coluna_id,
      titulo: linha.titulo,
      descricao: linha.descricao,
      criadoPor: linha.criado_por,
      atribuidoA: linha.atribuido_a,
      prioridade: linha.prioridade,
      prazo: linha.prazo,
      tempoEstimadoHoras: linha.tempo_estimado_horas === null ? null : Number(linha.tempo_estimado_horas),
      ordem: linha.ordem,
      criadoEm: linha.criado_em,
      atualizadoEm: linha.atualizado_em,
    };
  }

  private mapearHistorico(linha: LinhaHistorico): MovimentoHistorico {
    return {
      id: linha.id,
      tarefaId: linha.tarefa_id,
      colunaOrigemId: linha.coluna_origem_id,
      colunaDestinoId: linha.coluna_destino_id,
      movidoPor: linha.movido_por,
      responsavelId: linha.responsavel_id,
      criadoEm: linha.criado_em,
    };
  }

  private mapearComentario(linha: LinhaComentario): ComentarioTarefa {
    return {
      id: linha.id,
      tarefaId: linha.tarefa_id,
      autorId: linha.autor_id,
      corpo: linha.corpo,
      criadoEm: linha.criado_em,
    };
  }

  private mapearAtribuicaoHistorico(linha: LinhaAtribuicaoHistorico): AtribuicaoHistorico {
    return {
      id: linha.id,
      tarefaId: linha.tarefa_id,
      deUsuarioId: linha.de_usuario_id,
      paraUsuarioId: linha.para_usuario_id,
      atribuidoPor: linha.atribuido_por,
      criadoEm: linha.criado_em,
    };
  }

  private mapearMembroEquipe(linha: LinhaMembroEquipe): MembroEquipeTarefa {
    return {
      id: linha.id,
      tarefaId: linha.tarefa_id,
      usuarioId: linha.usuario_id,
      adicionadoPor: linha.adicionado_por,
      criadoEm: linha.criado_em,
    };
  }

  private mapearAnexo(linha: LinhaAnexo): AnexoTarefa {
    return {
      id: linha.id,
      tarefaId: linha.tarefa_id,
      nomeArquivo: linha.nome_arquivo,
      storageRef: linha.storage_ref,
      criadoPor: linha.criado_por,
      criadoEm: linha.criado_em,
    };
  }
}
