import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { DirecaoNotaFiscal } from '../../notas-fiscais/dominio/nota-fiscal';
import { StatusNotaServico } from '../dominio/nota-servico';
import { DadosNovaNotaServico, NotaServicoResumo, NotasServicoRepositorioPort } from '../aplicacao/portas/notas-servico-repositorio.port';

interface LinhaNotaServico {
  id: string;
  empresa_id: string;
  chave_acesso: string;
  situacao: string;
  numero_nfse: string;
  data_processamento: string;
  data_emissao_dps: string;
  direcao: DirecaoNotaFiscal;
  emitente_cnpj: string | null;
  emitente_cpf: string | null;
  emitente_nome: string;
  tomador_cnpj: string | null;
  tomador_cpf: string | null;
  tomador_nome: string | null;
  descricao_servico: string;
  codigo_tributacao_nacional: string | null;
  valor_liquido: number;
  valor_issqn: number;
  valor_base_calculo: number;
  status: StatusNotaServico;
  xml_storage_ref: string;
  motivo_rejeicao: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  criado_em: string;
}

const COLUNAS =
  'id, empresa_id, chave_acesso, situacao, numero_nfse, data_processamento, data_emissao_dps, direcao, emitente_cnpj, emitente_cpf, emitente_nome, tomador_cnpj, tomador_cpf, tomador_nome, descricao_servico, codigo_tributacao_nacional, valor_liquido, valor_issqn, valor_base_calculo, status, xml_storage_ref, motivo_rejeicao, aprovado_por, aprovado_em, criado_em';

@Injectable()
export class NotasServicoRepositorioSupabase implements NotasServicoRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovaNotaServico): Promise<string> {
    const { extraida } = dados;
    const { data, error } = await this.supabase.admin.rpc('criar_nota_servico', {
      p_empresa_id: dados.empresaId,
      p_chave_acesso: extraida.chaveAcesso,
      p_situacao: extraida.situacao,
      p_numero_nfse: extraida.numeroNfse,
      p_data_processamento: extraida.dataProcessamento,
      p_data_emissao_dps: extraida.dataEmissaoDps,
      p_direcao: dados.direcao,
      p_emitente_cnpj: extraida.emitenteCnpj,
      p_emitente_cpf: extraida.emitenteCpf,
      p_emitente_nome: extraida.emitenteNome,
      p_tomador_cnpj: extraida.tomadorCnpj,
      p_tomador_cpf: extraida.tomadorCpf,
      p_tomador_nome: extraida.tomadorNome,
      p_descricao_servico: extraida.descricaoServico,
      p_codigo_tributacao_nacional: extraida.codigoTributacaoNacional,
      p_valor_liquido: extraida.valorLiquido,
      p_valor_issqn: extraida.valorIssqn,
      p_valor_base_calculo: extraida.valorBaseCalculo,
      p_xml_storage_ref: dados.xmlStorageRef,
      p_xml_bruto: extraida.xmlBruto,
    });
    if (error) throw new InternalServerErrorException(`Falha ao criar NFS-e: ${error.message}`);
    return data as string;
  }

  async buscarPorChave(empresaId: string, chaveAcesso: string): Promise<NotaServicoResumo | null> {
    const { data, error } = await this.supabase.admin
      .from('notas_servico')
      .select(COLUNAS)
      .eq('empresa_id', empresaId)
      .eq('chave_acesso', chaveAcesso)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar NFS-e por chave: ${error.message}`);
    return data ? this.mapear(data) : null;
  }

  async listarPendentes(empresaId: string): Promise<NotaServicoResumo[]> {
    const { data, error } = await this.supabase.admin
      .from('notas_servico')
      .select(COLUNAS)
      .eq('empresa_id', empresaId)
      .eq('status', 'capturada')
      .order('criado_em', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao listar NFS-e pendentes: ${error.message}`);
    return (data as LinhaNotaServico[]).map((linha) => this.mapear(linha));
  }

  async obterDetalhe(id: string, empresaId: string): Promise<NotaServicoResumo | null> {
    const { data, error } = await this.supabase.admin
      .from('notas_servico')
      .select(COLUNAS)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao obter detalhe da NFS-e: ${error.message}`);
    return data ? this.mapear(data) : null;
  }

  async marcarAprovada(id: string, aprovadoPor: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('notas_servico')
      .update({ status: 'aprovada', aprovado_por: aprovadoPor, aprovado_em: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao aprovar NFS-e: ${error.message}`);
  }

  async marcarRejeitada(id: string, motivoRejeicao: string): Promise<void> {
    const { error } = await this.supabase.admin.from('notas_servico').update({ status: 'rejeitada', motivo_rejeicao: motivoRejeicao }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao rejeitar NFS-e: ${error.message}`);
  }

  private mapear(linha: LinhaNotaServico): NotaServicoResumo {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      chaveAcesso: linha.chave_acesso,
      situacao: linha.situacao,
      numeroNfse: linha.numero_nfse,
      dataProcessamento: linha.data_processamento,
      dataEmissaoDps: linha.data_emissao_dps,
      direcao: linha.direcao,
      emitenteCnpj: linha.emitente_cnpj,
      emitenteCpf: linha.emitente_cpf,
      emitenteNome: linha.emitente_nome,
      tomadorCnpj: linha.tomador_cnpj,
      tomadorCpf: linha.tomador_cpf,
      tomadorNome: linha.tomador_nome,
      descricaoServico: linha.descricao_servico,
      codigoTributacaoNacional: linha.codigo_tributacao_nacional,
      valorLiquido: linha.valor_liquido,
      valorIssqn: linha.valor_issqn,
      valorBaseCalculo: linha.valor_base_calculo,
      status: linha.status,
      xmlStorageRef: linha.xml_storage_ref,
      motivoRejeicao: linha.motivo_rejeicao,
      aprovadoPor: linha.aprovado_por,
      aprovadoEm: linha.aprovado_em,
      criadoEm: linha.criado_em,
    };
  }
}
