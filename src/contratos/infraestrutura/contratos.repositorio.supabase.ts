import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { StatusContrato } from '../dominio/contrato';
import {
  ConfiguracaoContratos,
  ContratoAditivo,
  ContratoGerado,
  ContratoTag,
  ContratosRepositorioPort,
  DadosAtualizarContrato,
  DadosCobrancaInterna,
  DadosConfiguracaoContratos,
  DadosContratoTag,
  DadosModeloContrato,
  DadosNovoAditivo,
  DadosNovoContrato,
  FiltroContratos,
  ModeloContrato,
} from '../aplicacao/portas/contratos-repositorio.port';

interface LinhaModelo {
  id: string;
  empresa_id: string;
  titulo: string;
  conteudo_template: string;
  tipo_conteudo: 'html' | 'texto';
  criado_em: string;
  atualizado_em: string;
}

interface LinhaTag {
  id: string;
  empresa_id: string;
  nome_tag: string;
  descricao: string | null;
}

interface LinhaConfiguracao {
  empresa_id: string;
  conta_patrimonial_receber_id: string | null;
  conta_resultado_receita_id: string | null;
  conta_patrimonial_pagar_id: string | null;
  conta_resultado_despesa_id: string | null;
  url_base_assinatura: string | null;
}

interface LinhaContrato {
  id: string;
  empresa_id: string;
  modelo_id: string | null;
  cliente_id: string | null;
  empresa_contraparte_id: string | null;
  titulo: string;
  status: StatusContrato;
  valores_tags: Record<string, string>;
  conteudo_renderizado: string;
  valor_total: number | null;
  conta_receber_id: string | null;
  conta_pagar_id: string | null;
  token_assinatura: string;
  assinatura_nome: string | null;
  assinatura_selfie_ref: string | null;
  assinado_em: string | null;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
}

interface LinhaAditivo {
  id: string;
  contrato_id: string;
  descricao: string;
  valor_total_novo: number | null;
  numero_parcelas_novo: number | null;
  conta_receber_anterior_id: string | null;
  conta_receber_nova_id: string | null;
  criado_por: string;
  criado_em: string;
}

const COLUNAS_MODELO = 'id, empresa_id, titulo, conteudo_template, tipo_conteudo, criado_em, atualizado_em';
const COLUNAS_TAG = 'id, empresa_id, nome_tag, descricao';
const COLUNAS_CONFIGURACAO =
  'empresa_id, conta_patrimonial_receber_id, conta_resultado_receita_id, conta_patrimonial_pagar_id, conta_resultado_despesa_id, url_base_assinatura';
const COLUNAS_CONTRATO =
  'id, empresa_id, modelo_id, cliente_id, empresa_contraparte_id, titulo, status, valores_tags, conteudo_renderizado, valor_total, conta_receber_id, conta_pagar_id, token_assinatura, assinatura_nome, assinatura_selfie_ref, assinado_em, criado_por, criado_em, atualizado_em';
const COLUNAS_ADITIVO =
  'id, contrato_id, descricao, valor_total_novo, numero_parcelas_novo, conta_receber_anterior_id, conta_receber_nova_id, criado_por, criado_em';

@Injectable()
export class ContratosRepositorioSupabase implements ContratosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criarModelo(dados: DadosModeloContrato): Promise<ModeloContrato> {
    const { data, error } = await this.supabase.admin
      .from('modelos_contrato')
      .insert({ empresa_id: dados.empresaId, titulo: dados.titulo, conteudo_template: dados.conteudoTemplate, tipo_conteudo: dados.tipoConteudo })
      .select(COLUNAS_MODELO)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar modelo de contrato: ${error.message}`);
    return this.mapearModelo(data as LinhaModelo);
  }

  async listarModelosPorEmpresa(empresaId: string): Promise<ModeloContrato[]> {
    const { data, error } = await this.supabase.admin
      .from('modelos_contrato')
      .select(COLUNAS_MODELO)
      .eq('empresa_id', empresaId)
      .order('titulo');
    if (error) throw new InternalServerErrorException(`Falha ao listar modelos de contrato: ${error.message}`);
    return (data as LinhaModelo[]).map((linha) => this.mapearModelo(linha));
  }

  async obterModeloPorId(id: string): Promise<ModeloContrato | null> {
    const { data, error } = await this.supabase.admin.from('modelos_contrato').select(COLUNAS_MODELO).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar modelo de contrato: ${error.message}`);
    return data ? this.mapearModelo(data as LinhaModelo) : null;
  }

  async atualizarModelo(id: string, dados: Partial<DadosModeloContrato>): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.titulo !== undefined) campos.titulo = dados.titulo;
    if (dados.conteudoTemplate !== undefined) campos.conteudo_template = dados.conteudoTemplate;
    if (dados.tipoConteudo !== undefined) campos.tipo_conteudo = dados.tipoConteudo;

    const { error } = await this.supabase.admin.from('modelos_contrato').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar modelo de contrato: ${error.message}`);
  }

  async excluirModelo(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('modelos_contrato').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir modelo de contrato: ${error.message}`);
  }

  async criarTag(dados: DadosContratoTag): Promise<ContratoTag> {
    const { data, error } = await this.supabase.admin
      .from('contrato_tags')
      .insert({ empresa_id: dados.empresaId, nome_tag: dados.nomeTag, descricao: dados.descricao ?? null })
      .select(COLUNAS_TAG)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar tag de contrato: ${error.message}`);
    return this.mapearTag(data as LinhaTag);
  }

  async listarTagsPorEmpresa(empresaId: string): Promise<ContratoTag[]> {
    const { data, error } = await this.supabase.admin.from('contrato_tags').select(COLUNAS_TAG).eq('empresa_id', empresaId).order('nome_tag');
    if (error) throw new InternalServerErrorException(`Falha ao listar tags de contrato: ${error.message}`);
    return (data as LinhaTag[]).map((linha) => this.mapearTag(linha));
  }

  async excluirTag(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('contrato_tags').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir tag de contrato: ${error.message}`);
  }

  async obterConfiguracao(empresaId: string): Promise<ConfiguracaoContratos | null> {
    const { data, error } = await this.supabase.admin
      .from('configuracao_contratos')
      .select(COLUNAS_CONFIGURACAO)
      .eq('empresa_id', empresaId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar configuração de contratos: ${error.message}`);
    return data ? this.mapearConfiguracao(data as LinhaConfiguracao) : null;
  }

  async salvarConfiguracao(empresaId: string, dados: DadosConfiguracaoContratos): Promise<ConfiguracaoContratos> {
    // Merge com o que já existe -- 4 campos agora (receber/receita/pagar/despesa), salvar
    // só 2 de cada vez (ex: tela configura só o lado credor) não pode zerar os outros 2.
    const existente = await this.obterConfiguracao(empresaId);
    const { data, error } = await this.supabase.admin
      .from('configuracao_contratos')
      .upsert(
        {
          empresa_id: empresaId,
          conta_patrimonial_receber_id: dados.contaPatrimonialReceberId !== undefined ? dados.contaPatrimonialReceberId : (existente?.contaPatrimonialReceberId ?? null),
          conta_resultado_receita_id: dados.contaResultadoReceitaId !== undefined ? dados.contaResultadoReceitaId : (existente?.contaResultadoReceitaId ?? null),
          conta_patrimonial_pagar_id: dados.contaPatrimonialPagarId !== undefined ? dados.contaPatrimonialPagarId : (existente?.contaPatrimonialPagarId ?? null),
          conta_resultado_despesa_id: dados.contaResultadoDespesaId !== undefined ? dados.contaResultadoDespesaId : (existente?.contaResultadoDespesaId ?? null),
          url_base_assinatura: dados.urlBaseAssinatura !== undefined ? dados.urlBaseAssinatura : (existente?.urlBaseAssinatura ?? null),
        },
        { onConflict: 'empresa_id' },
      )
      .select(COLUNAS_CONFIGURACAO)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao salvar configuração de contratos: ${error.message}`);
    return this.mapearConfiguracao(data as LinhaConfiguracao);
  }

  async criarContrato(dados: DadosNovoContrato): Promise<ContratoGerado> {
    const { data, error } = await this.supabase.admin
      .from('contratos_gerados')
      .insert({
        empresa_id: dados.empresaId,
        modelo_id: dados.modeloId,
        cliente_id: dados.clienteId,
        empresa_contraparte_id: dados.empresaContraparteId,
        titulo: dados.titulo,
        valores_tags: dados.valoresTags,
        conteudo_renderizado: dados.conteudoRenderizado,
        valor_total: dados.valorTotal,
        conta_receber_id: dados.contaReceberId,
        conta_pagar_id: dados.contaPagarId,
        criado_por: dados.criadoPor,
      })
      .select(COLUNAS_CONTRATO)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar contrato: ${error.message}`);
    return this.mapearContrato(data as LinhaContrato);
  }

  async listarContratosPorEmpresa(empresaId: string, filtro?: FiltroContratos): Promise<ContratoGerado[]> {
    let query = this.supabase.admin.from('contratos_gerados').select(COLUNAS_CONTRATO).eq('empresa_id', empresaId).order('criado_em', { ascending: false });
    if (filtro?.status) query = query.eq('status', filtro.status);
    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(`Falha ao listar contratos: ${error.message}`);
    return (data as LinhaContrato[]).map((linha) => this.mapearContrato(linha));
  }

  async obterContratoPorId(id: string): Promise<ContratoGerado | null> {
    const { data, error } = await this.supabase.admin.from('contratos_gerados').select(COLUNAS_CONTRATO).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar contrato: ${error.message}`);
    return data ? this.mapearContrato(data as LinhaContrato) : null;
  }

  async obterContratoPorToken(token: string): Promise<ContratoGerado | null> {
    const { data, error } = await this.supabase.admin.from('contratos_gerados').select(COLUNAS_CONTRATO).eq('token_assinatura', token).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar contrato pelo token: ${error.message}`);
    return data ? this.mapearContrato(data as LinhaContrato) : null;
  }

  async atualizarContrato(id: string, dados: DadosAtualizarContrato): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.titulo !== undefined) campos.titulo = dados.titulo;
    if (dados.valoresTags !== undefined) campos.valores_tags = dados.valoresTags;
    if (dados.conteudoRenderizado !== undefined) campos.conteudo_renderizado = dados.conteudoRenderizado;
    if (dados.valorTotal !== undefined) campos.valor_total = dados.valorTotal;
    if (dados.contaReceberId !== undefined) campos.conta_receber_id = dados.contaReceberId;
    if (dados.contaPagarId !== undefined) campos.conta_pagar_id = dados.contaPagarId;

    const { error } = await this.supabase.admin.from('contratos_gerados').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar contrato: ${error.message}`);
  }

  async excluirContrato(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('contratos_gerados').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir contrato: ${error.message}`);
  }

  async marcarStatus(id: string, status: StatusContrato): Promise<void> {
    const { error } = await this.supabase.admin.from('contratos_gerados').update({ status }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar status do contrato: ${error.message}`);
  }

  async registrarAssinatura(id: string, dados: { assinaturaNome: string; assinaturaSelfieRef: string }): Promise<void> {
    const { error } = await this.supabase.admin
      .from('contratos_gerados')
      .update({
        status: 'ativo',
        assinatura_nome: dados.assinaturaNome,
        assinatura_selfie_ref: dados.assinaturaSelfieRef,
        assinado_em: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao registrar assinatura do contrato: ${error.message}`);
  }

  async criarAditivo(dados: DadosNovoAditivo): Promise<ContratoAditivo> {
    const { data, error } = await this.supabase.admin
      .from('contrato_aditivos')
      .insert({
        contrato_id: dados.contratoId,
        descricao: dados.descricao,
        valor_total_novo: dados.valorTotalNovo,
        numero_parcelas_novo: dados.numeroParcelasNovo,
        conta_receber_anterior_id: dados.contaReceberAnteriorId,
        conta_receber_nova_id: dados.contaReceberNovaId,
        criado_por: dados.criadoPor,
      })
      .select(COLUNAS_ADITIVO)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao registrar aditivo: ${error.message}`);
    return this.mapearAditivo(data as LinhaAditivo);
  }

  async listarAditivosPorContrato(contratoId: string): Promise<ContratoAditivo[]> {
    const { data, error } = await this.supabase.admin
      .from('contrato_aditivos')
      .select(COLUNAS_ADITIVO)
      .eq('contrato_id', contratoId)
      .order('criado_em', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao listar aditivos: ${error.message}`);
    return (data as LinhaAditivo[]).map((linha) => this.mapearAditivo(linha));
  }

  private mapearModelo(linha: LinhaModelo): ModeloContrato {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      titulo: linha.titulo,
      conteudoTemplate: linha.conteudo_template,
      tipoConteudo: linha.tipo_conteudo,
      criadoEm: linha.criado_em,
      atualizadoEm: linha.atualizado_em,
    };
  }

  private mapearTag(linha: LinhaTag): ContratoTag {
    return { id: linha.id, empresaId: linha.empresa_id, nomeTag: linha.nome_tag, descricao: linha.descricao };
  }

  private mapearConfiguracao(linha: LinhaConfiguracao): ConfiguracaoContratos {
    return {
      empresaId: linha.empresa_id,
      contaPatrimonialReceberId: linha.conta_patrimonial_receber_id,
      contaResultadoReceitaId: linha.conta_resultado_receita_id,
      contaPatrimonialPagarId: linha.conta_patrimonial_pagar_id,
      contaResultadoDespesaId: linha.conta_resultado_despesa_id,
      urlBaseAssinatura: linha.url_base_assinatura,
    };
  }

  async emitirCobrancaInterna(dados: DadosCobrancaInterna): Promise<{ contaReceberId: string; contaPagarId: string }> {
    const { data, error } = await this.supabase.admin.rpc('emitir_cobranca_interna', {
      p_empresa_credora_id: dados.empresaCredoraId,
      p_nome_devedor: dados.nomeDevedor,
      p_conta_patrimonial_credora_id: dados.contaPatrimonialCredoraId,
      p_conta_resultado_credora_id: dados.contaResultadoCredoraId,
      p_empresa_devedora_id: dados.empresaDevedoraId,
      p_nome_credor: dados.nomeCredor,
      p_conta_resultado_devedora_id: dados.contaResultadoDevedoraId,
      p_conta_patrimonial_devedora_id: dados.contaPatrimonialDevedoraId,
      p_descricao: dados.descricao,
      p_data_emissao: dados.dataEmissao,
      p_criado_por: dados.criadoPor,
      p_parcelas: dados.parcelas.map((p) => ({ numero_parcela: p.numeroParcela, valor_parcela: p.valorParcela, data_vencimento: p.dataVencimento })),
      p_contrato_id: dados.contratoId,
    });
    if (error) throw new InternalServerErrorException(`Falha ao emitir cobrança interna: ${error.message}`);
    const linha = (data as { conta_receber_id: string; conta_pagar_id: string }[])[0];
    return { contaReceberId: linha.conta_receber_id, contaPagarId: linha.conta_pagar_id };
  }

  async estornarCobrancaInternaDoContrato(contratoId: string, motivo: string, executadoPor: string): Promise<void> {
    const { data: vinculo, error: erroVinculo } = await this.supabase.admin
      .from('vinculos_financeiros_espelho')
      .select('id')
      .eq('contrato_id', contratoId)
      .eq('estornado', false)
      .maybeSingle();
    if (erroVinculo) throw new InternalServerErrorException(`Falha ao buscar vínculo financeiro do contrato: ${erroVinculo.message}`);
    if (!vinculo) throw new InternalServerErrorException(`Contrato ${contratoId} não tem vínculo financeiro ativo pra estornar`);

    const { error } = await this.supabase.admin.rpc('estornar_cobranca_interna', {
      p_vinculo_id: vinculo.id,
      p_motivo: motivo,
      p_executado_por: executadoPor,
    });
    if (error) throw new InternalServerErrorException(`Falha ao estornar cobrança interna: ${error.message}`);
  }

  private mapearContrato(linha: LinhaContrato): ContratoGerado {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      modeloId: linha.modelo_id,
      clienteId: linha.cliente_id,
      empresaContraparteId: linha.empresa_contraparte_id,
      titulo: linha.titulo,
      status: linha.status,
      valoresTags: linha.valores_tags ?? {},
      conteudoRenderizado: linha.conteudo_renderizado,
      valorTotal: linha.valor_total,
      contaReceberId: linha.conta_receber_id,
      contaPagarId: linha.conta_pagar_id,
      tokenAssinatura: linha.token_assinatura,
      assinaturaNome: linha.assinatura_nome,
      assinaturaSelfieRef: linha.assinatura_selfie_ref,
      assinadoEm: linha.assinado_em,
      criadoPor: linha.criado_por,
      criadoEm: linha.criado_em,
      atualizadoEm: linha.atualizado_em,
    };
  }

  private mapearAditivo(linha: LinhaAditivo): ContratoAditivo {
    return {
      id: linha.id,
      contratoId: linha.contrato_id,
      descricao: linha.descricao,
      valorTotalNovo: linha.valor_total_novo,
      numeroParcelasNovo: linha.numero_parcelas_novo,
      contaReceberAnteriorId: linha.conta_receber_anterior_id,
      contaReceberNovaId: linha.conta_receber_nova_id,
      criadoPor: linha.criado_por,
      criadoEm: linha.criado_em,
    };
  }
}
