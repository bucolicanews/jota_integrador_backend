import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { StatusDocumentoSocietario } from '../dominio/documento-societario';
import {
  BlocoSocietario,
  DadosAtualizarDocumentoSocietario,
  DadosBlocoSocietario,
  DadosModeloSocietario,
  DadosNovoDocumentoSocietario,
  DocumentoSocietarioGerado,
  DocumentosSocietariosRepositorioPort,
  FiltroDocumentosSocietarios,
  ModeloSocietario,
} from '../aplicacao/portas/documentos-societarios-repositorio.port';

interface LinhaModelo {
  id: string;
  empresa_id: string;
  titulo: string;
  conteudo_template: string;
  tipo_documento: string;
  tipo_conteudo: 'html' | 'texto';
  criado_em: string;
  atualizado_em: string;
}

interface LinhaBloco {
  id: string;
  empresa_id: string;
  titulo: string;
  conteudo: string;
  tipo_bloco: string | null;
  criado_em: string;
}

interface LinhaDocumento {
  id: string;
  empresa_id: string;
  modelo_id: string | null;
  cliente_id: string | null;
  titulo: string;
  status: StatusDocumentoSocietario;
  valores_tags: Record<string, string>;
  conteudo_renderizado: string;
  conteudo_principal_manual: string | null;
  data_registro: string | null;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
}

const COLUNAS_MODELO = 'id, empresa_id, titulo, conteudo_template, tipo_documento, tipo_conteudo, criado_em, atualizado_em';
const COLUNAS_BLOCO = 'id, empresa_id, titulo, conteudo, tipo_bloco, criado_em';
const COLUNAS_DOCUMENTO =
  'id, empresa_id, modelo_id, cliente_id, titulo, status, valores_tags, conteudo_renderizado, conteudo_principal_manual, data_registro, criado_por, criado_em, atualizado_em';

@Injectable()
export class DocumentosSocietariosRepositorioSupabase implements DocumentosSocietariosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criarModelo(dados: DadosModeloSocietario): Promise<ModeloSocietario> {
    const { data, error } = await this.supabase.admin
      .from('modelos_societarios')
      .insert({
        empresa_id: dados.empresaId,
        titulo: dados.titulo,
        conteudo_template: dados.conteudoTemplate,
        tipo_documento: dados.tipoDocumento,
        tipo_conteudo: dados.tipoConteudo,
      })
      .select(COLUNAS_MODELO)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar modelo societário: ${error.message}`);
    return this.mapearModelo(data as LinhaModelo);
  }

  async listarModelosPorEmpresa(empresaId: string): Promise<ModeloSocietario[]> {
    const { data, error } = await this.supabase.admin.from('modelos_societarios').select(COLUNAS_MODELO).eq('empresa_id', empresaId).order('titulo');
    if (error) throw new InternalServerErrorException(`Falha ao listar modelos societários: ${error.message}`);
    return (data as LinhaModelo[]).map((linha) => this.mapearModelo(linha));
  }

  async obterModeloPorId(id: string): Promise<ModeloSocietario | null> {
    const { data, error } = await this.supabase.admin.from('modelos_societarios').select(COLUNAS_MODELO).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar modelo societário: ${error.message}`);
    return data ? this.mapearModelo(data as LinhaModelo) : null;
  }

  async atualizarModelo(id: string, dados: Partial<DadosModeloSocietario>): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.titulo !== undefined) campos.titulo = dados.titulo;
    if (dados.conteudoTemplate !== undefined) campos.conteudo_template = dados.conteudoTemplate;
    if (dados.tipoDocumento !== undefined) campos.tipo_documento = dados.tipoDocumento;
    if (dados.tipoConteudo !== undefined) campos.tipo_conteudo = dados.tipoConteudo;

    const { error } = await this.supabase.admin.from('modelos_societarios').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar modelo societário: ${error.message}`);
  }

  async excluirModelo(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('modelos_societarios').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir modelo societário: ${error.message}`);
  }

  async criarBloco(dados: DadosBlocoSocietario): Promise<BlocoSocietario> {
    const { data, error } = await this.supabase.admin
      .from('blocos_societarios')
      .insert({ empresa_id: dados.empresaId, titulo: dados.titulo, conteudo: dados.conteudo, tipo_bloco: dados.tipoBloco ?? null })
      .select(COLUNAS_BLOCO)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar bloco societário: ${error.message}`);
    return this.mapearBloco(data as LinhaBloco);
  }

  async listarBlocosPorEmpresa(empresaId: string): Promise<BlocoSocietario[]> {
    const { data, error } = await this.supabase.admin.from('blocos_societarios').select(COLUNAS_BLOCO).eq('empresa_id', empresaId).order('titulo');
    if (error) throw new InternalServerErrorException(`Falha ao listar blocos societários: ${error.message}`);
    return (data as LinhaBloco[]).map((linha) => this.mapearBloco(linha));
  }

  async obterBlocoPorId(id: string): Promise<BlocoSocietario | null> {
    const { data, error } = await this.supabase.admin.from('blocos_societarios').select(COLUNAS_BLOCO).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar bloco societário: ${error.message}`);
    return data ? this.mapearBloco(data as LinhaBloco) : null;
  }

  async atualizarBloco(id: string, dados: Partial<DadosBlocoSocietario>): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.titulo !== undefined) campos.titulo = dados.titulo;
    if (dados.conteudo !== undefined) campos.conteudo = dados.conteudo;
    if (dados.tipoBloco !== undefined) campos.tipo_bloco = dados.tipoBloco;

    const { error } = await this.supabase.admin.from('blocos_societarios').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar bloco societário: ${error.message}`);
  }

  async excluirBloco(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('blocos_societarios').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir bloco societário: ${error.message}`);
  }

  async criarDocumento(dados: DadosNovoDocumentoSocietario): Promise<DocumentoSocietarioGerado> {
    const { data, error } = await this.supabase.admin
      .from('documentos_societarios_gerados')
      .insert({
        empresa_id: dados.empresaId,
        modelo_id: dados.modeloId,
        cliente_id: dados.clienteId,
        titulo: dados.titulo,
        valores_tags: dados.valoresTags,
        conteudo_renderizado: dados.conteudoRenderizado,
        conteudo_principal_manual: dados.conteudoRenderizado,
        data_registro: dados.dataRegistro,
        criado_por: dados.criadoPor,
      })
      .select(COLUNAS_DOCUMENTO)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar documento societário: ${error.message}`);
    return this.mapearDocumento(data as LinhaDocumento);
  }

  async listarDocumentosPorEmpresa(empresaId: string, filtro?: FiltroDocumentosSocietarios): Promise<DocumentoSocietarioGerado[]> {
    let query = this.supabase.admin
      .from('documentos_societarios_gerados')
      .select(COLUNAS_DOCUMENTO)
      .eq('empresa_id', empresaId)
      .order('criado_em', { ascending: false });
    if (filtro?.status) query = query.eq('status', filtro.status);
    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(`Falha ao listar documentos societários: ${error.message}`);
    return (data as LinhaDocumento[]).map((linha) => this.mapearDocumento(linha));
  }

  async obterDocumentoPorId(id: string): Promise<DocumentoSocietarioGerado | null> {
    const { data, error } = await this.supabase.admin.from('documentos_societarios_gerados').select(COLUNAS_DOCUMENTO).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar documento societário: ${error.message}`);
    return data ? this.mapearDocumento(data as LinhaDocumento) : null;
  }

  async atualizarDocumento(id: string, dados: DadosAtualizarDocumentoSocietario): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.titulo !== undefined) campos.titulo = dados.titulo;
    if (dados.conteudoPrincipalManual !== undefined) campos.conteudo_principal_manual = dados.conteudoPrincipalManual;
    if (dados.dataRegistro !== undefined) campos.data_registro = dados.dataRegistro;

    const { error } = await this.supabase.admin.from('documentos_societarios_gerados').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar documento societário: ${error.message}`);
  }

  async excluirDocumento(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('documentos_societarios_gerados').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir documento societário: ${error.message}`);
  }

  async marcarStatus(id: string, status: StatusDocumentoSocietario): Promise<void> {
    const { error } = await this.supabase.admin.from('documentos_societarios_gerados').update({ status }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar status do documento societário: ${error.message}`);
  }

  private mapearModelo(linha: LinhaModelo): ModeloSocietario {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      titulo: linha.titulo,
      conteudoTemplate: linha.conteudo_template,
      tipoDocumento: linha.tipo_documento,
      tipoConteudo: linha.tipo_conteudo,
      criadoEm: linha.criado_em,
      atualizadoEm: linha.atualizado_em,
    };
  }

  private mapearBloco(linha: LinhaBloco): BlocoSocietario {
    return { id: linha.id, empresaId: linha.empresa_id, titulo: linha.titulo, conteudo: linha.conteudo, tipoBloco: linha.tipo_bloco, criadoEm: linha.criado_em };
  }

  private mapearDocumento(linha: LinhaDocumento): DocumentoSocietarioGerado {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      modeloId: linha.modelo_id,
      clienteId: linha.cliente_id,
      titulo: linha.titulo,
      status: linha.status,
      valoresTags: linha.valores_tags ?? {},
      conteudoRenderizado: linha.conteudo_renderizado,
      conteudoPrincipalManual: linha.conteudo_principal_manual,
      dataRegistro: linha.data_registro,
      criadoPor: linha.criado_por,
      criadoEm: linha.criado_em,
      atualizadoEm: linha.atualizado_em,
    };
  }
}
