import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { StatusProtocolo } from '../dominio/protocolo';
import {
  AnexoProtocolo,
  DadosAtualizarProtocolo,
  DadosNovoProtocolo,
  FiltroProtocolos,
  Protocolo,
  ProtocolosRepositorioPort,
} from '../aplicacao/portas/protocolos-repositorio.port';

interface LinhaProtocolo {
  id: string;
  empresa_id: string;
  cliente_id: string;
  numero_protocolo: string;
  titulo: string;
  descricao: string | null;
  link_tarefa: string | null;
  status: StatusProtocolo;
  nome_resp_recebimento: string | null;
  img_protocolo_ref: string | null;
  observacao_status: string | null;
  data_criacao: string;
  data_impressao: string | null;
  data_recebimento: string | null;
  criado_por: string;
  usuario_criador_nome: string | null;
  criado_em: string;
}

interface LinhaAnexo {
  id: string;
  protocolo_id: string;
  nome_arquivo: string;
  storage_ref: string;
  criado_em: string;
}

const COLUNAS =
  'id, empresa_id, cliente_id, numero_protocolo, titulo, descricao, link_tarefa, status, nome_resp_recebimento, img_protocolo_ref, observacao_status, data_criacao, data_impressao, data_recebimento, criado_por, usuario_criador_nome, criado_em';

@Injectable()
export class ProtocolosRepositorioSupabase implements ProtocolosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoProtocolo): Promise<Protocolo> {
    const { data, error } = await this.supabase.admin
      .from('protocolos')
      .insert({
        empresa_id: dados.empresaId,
        cliente_id: dados.clienteId,
        numero_protocolo: dados.numeroProtocolo,
        titulo: dados.titulo,
        descricao: dados.descricao,
        link_tarefa: dados.linkTarefa,
        criado_por: dados.criadoPor,
        usuario_criador_nome: dados.usuarioCriadorNome,
      })
      .select(COLUNAS)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar protocolo: ${error.message}`);
    return this.mapear(data as LinhaProtocolo);
  }

  async listarPorEmpresa(empresaId: string, filtro?: FiltroProtocolos): Promise<Protocolo[]> {
    let query = this.supabase.admin.from('protocolos').select(COLUNAS).eq('empresa_id', empresaId).order('data_criacao', { ascending: false });
    if (filtro?.status) query = query.eq('status', filtro.status);
    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(`Falha ao listar protocolos: ${error.message}`);
    return (data as LinhaProtocolo[]).map((linha) => this.mapear(linha));
  }

  async obterPorId(id: string): Promise<Protocolo | null> {
    const { data, error } = await this.supabase.admin.from('protocolos').select(COLUNAS).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar protocolo: ${error.message}`);
    return data ? this.mapear(data as LinhaProtocolo) : null;
  }

  async atualizar(id: string, dados: DadosAtualizarProtocolo): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.clienteId !== undefined) campos.cliente_id = dados.clienteId;
    if (dados.titulo !== undefined) campos.titulo = dados.titulo;
    if (dados.descricao !== undefined) campos.descricao = dados.descricao;
    if (dados.linkTarefa !== undefined) campos.link_tarefa = dados.linkTarefa;

    const { error } = await this.supabase.admin.from('protocolos').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar protocolo: ${error.message}`);
  }

  async excluir(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('protocolos').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir protocolo: ${error.message}`);
  }

  async avancarStatus(id: string, novoStatus: StatusProtocolo, dataEfeito: { dataImpressao?: string }): Promise<void> {
    const campos: Record<string, unknown> = { status: novoStatus };
    if (dataEfeito.dataImpressao) campos.data_impressao = dataEfeito.dataImpressao;

    const { error } = await this.supabase.admin.from('protocolos').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao avançar status do protocolo: ${error.message}`);
  }

  async registrarEntrega(id: string, dados: { nomeRespRecebimento: string; dataRecebimento: string; imgProtocoloRef: string }): Promise<void> {
    const { error } = await this.supabase.admin
      .from('protocolos')
      .update({
        status: 'entregue',
        nome_resp_recebimento: dados.nomeRespRecebimento,
        data_recebimento: dados.dataRecebimento,
        img_protocolo_ref: dados.imgProtocoloRef,
      })
      .eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao registrar entrega do protocolo: ${error.message}`);
  }

  async cancelarOuMarcarProblema(id: string, status: 'cancelado' | 'problema', observacaoStatus: string): Promise<void> {
    const { error } = await this.supabase.admin.from('protocolos').update({ status, observacao_status: observacaoStatus }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar status do protocolo: ${error.message}`);
  }

  async adicionarAnexo(protocoloId: string, nomeArquivo: string, storageRef: string): Promise<AnexoProtocolo> {
    const { data, error } = await this.supabase.admin
      .from('protocolos_anexos')
      .insert({ protocolo_id: protocoloId, nome_arquivo: nomeArquivo, storage_ref: storageRef })
      .select('id, protocolo_id, nome_arquivo, storage_ref, criado_em')
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao registrar anexo: ${error.message}`);
    return this.mapearAnexo(data as LinhaAnexo);
  }

  async listarAnexos(protocoloId: string): Promise<AnexoProtocolo[]> {
    const { data, error } = await this.supabase.admin
      .from('protocolos_anexos')
      .select('id, protocolo_id, nome_arquivo, storage_ref, criado_em')
      .eq('protocolo_id', protocoloId)
      .order('criado_em');
    if (error) throw new InternalServerErrorException(`Falha ao listar anexos: ${error.message}`);
    return (data as LinhaAnexo[]).map((linha) => this.mapearAnexo(linha));
  }

  async obterAnexo(id: string): Promise<AnexoProtocolo | null> {
    const { data, error } = await this.supabase.admin
      .from('protocolos_anexos')
      .select('id, protocolo_id, nome_arquivo, storage_ref, criado_em')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar anexo: ${error.message}`);
    return data ? this.mapearAnexo(data as LinhaAnexo) : null;
  }

  private mapear(linha: LinhaProtocolo): Protocolo {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      clienteId: linha.cliente_id,
      numeroProtocolo: linha.numero_protocolo,
      titulo: linha.titulo,
      descricao: linha.descricao,
      linkTarefa: linha.link_tarefa,
      status: linha.status,
      nomeRespRecebimento: linha.nome_resp_recebimento,
      imgProtocoloRef: linha.img_protocolo_ref,
      observacaoStatus: linha.observacao_status,
      dataCriacao: linha.data_criacao,
      dataImpressao: linha.data_impressao,
      dataRecebimento: linha.data_recebimento,
      criadoPor: linha.criado_por,
      usuarioCriadorNome: linha.usuario_criador_nome,
      criadoEm: linha.criado_em,
    };
  }

  private mapearAnexo(linha: LinhaAnexo): AnexoProtocolo {
    return {
      id: linha.id,
      protocoloId: linha.protocolo_id,
      nomeArquivo: linha.nome_arquivo,
      storageRef: linha.storage_ref,
      criadoEm: linha.criado_em,
    };
  }
}
