import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { DirecaoNotaFiscal, ModeloNotaFiscal, StatusNotaFiscal } from '../dominio/nota-fiscal';
import {
  ConfiguracaoLancamentosNf,
  DadosNovaNotaFiscal,
  DadosSalvarConfiguracaoLancamentosNf,
  ItemNotaFiscalPersistido,
  NotaFiscalDetalhe,
  NotaFiscalResumo,
  NotasFiscaisRepositorioPort,
  PagamentoNotaFiscalPersistido,
  ParcelaNotaFiscalPersistida,
} from '../aplicacao/portas/notas-fiscais-repositorio.port';

interface LinhaNota {
  id: string;
  empresa_id: string;
  chave_acesso: string;
  modelo: ModeloNotaFiscal;
  direcao: DirecaoNotaFiscal;
  numero: string;
  serie: string;
  data_emissao: string;
  c_stat: number;
  emitente_cnpj: string;
  emitente_nome: string;
  destinatario_documento: string | null;
  destinatario_nome: string | null;
  valor_total: number;
  fornecedor_id: string | null;
  cliente_id: string | null;
  conta_pagar_id: string | null;
  conta_receber_id: string | null;
  status: StatusNotaFiscal;
  xml_storage_ref: string;
  motivo_rejeicao: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  criado_em: string;
}

interface LinhaItem {
  id: string;
  nota_fiscal_id: string;
  numero_item: number;
  codigo_produto: string | null;
  descricao: string;
  ncm: string | null;
  cest: string | null;
  cfop: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  cst_csosn: string | null;
  valor_icms: number;
  valor_icms_st: number;
  valor_pis: number;
  cst_pis: string | null;
  valor_cofins: number;
  cst_cofins: string | null;
  valor_cbs: number;
  valor_ibs: number;
  c_class_trib: string | null;
  c_ativ_sn: string | null;
  p_ibs_sn: string | null;
  p_cbs_sn: string | null;
  imposto_bruto: unknown;
}

interface LinhaParcela {
  id: string;
  numero_duplicata: string;
  data_vencimento: string;
  valor: number;
}

interface LinhaPagamento {
  id: string;
  indicador_pagamento: string | null;
  forma_pagamento: string;
  valor: number;
}

interface LinhaConfig {
  empresa_id: string;
  conta_patrimonial_entrada_id: string;
  conta_resultado_entrada_id: string;
  conta_patrimonial_saida_id: string;
  conta_resultado_saida_id: string;
  conta_recebimento_vista_id: string | null;
}

const COLUNAS_NOTA =
  'id, empresa_id, chave_acesso, modelo, direcao, numero, serie, data_emissao, c_stat, emitente_cnpj, emitente_nome, destinatario_documento, destinatario_nome, valor_total, fornecedor_id, cliente_id, conta_pagar_id, conta_receber_id, status, xml_storage_ref, motivo_rejeicao, aprovado_por, aprovado_em, criado_em';

const COLUNAS_ITEM =
  'id, nota_fiscal_id, numero_item, codigo_produto, descricao, ncm, cest, cfop, quantidade, valor_unitario, valor_total, cst_csosn, valor_icms, valor_icms_st, valor_pis, cst_pis, valor_cofins, cst_cofins, valor_cbs, valor_ibs, c_class_trib, c_ativ_sn, p_ibs_sn, p_cbs_sn, imposto_bruto';

const COLUNAS_PARCELA = 'id, numero_duplicata, data_vencimento, valor';

const COLUNAS_PAGAMENTO = 'id, indicador_pagamento, forma_pagamento, valor';

@Injectable()
export class NotasFiscaisRepositorioSupabase implements NotasFiscaisRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovaNotaFiscal): Promise<string> {
    const { extraida } = dados;
    const { data, error } = await this.supabase.admin.rpc('criar_nota_fiscal_com_itens', {
      p_empresa_id: dados.empresaId,
      p_chave_acesso: extraida.chaveAcesso,
      p_modelo: extraida.modelo,
      p_direcao: dados.direcao,
      p_numero: extraida.numero,
      p_serie: extraida.serie,
      p_data_emissao: extraida.dataEmissao,
      p_c_stat: extraida.cStat,
      p_emitente_cnpj: extraida.emitenteCnpj,
      p_emitente_nome: extraida.emitenteNome,
      p_destinatario_documento: extraida.destinatarioDocumento,
      p_destinatario_nome: extraida.destinatarioNome,
      p_valor_total: extraida.valorTotal,
      p_fornecedor_id: dados.fornecedorId,
      p_cliente_id: dados.clienteId,
      p_xml_storage_ref: dados.xmlStorageRef,
      p_xml_bruto: extraida.xmlBruto,
      p_itens: extraida.itens.map((item) => ({
        numero_item: item.numeroItem,
        codigo_produto: item.codigoProduto,
        descricao: item.descricao,
        ncm: item.ncm,
        cest: item.cest,
        cfop: item.cfop,
        quantidade: item.quantidade,
        valor_unitario: item.valorUnitario,
        valor_total: item.valorTotal,
        cst_csosn: item.cstCsosn,
        valor_icms: item.valorIcms,
        valor_icms_st: item.valorIcmsSt,
        valor_pis: item.valorPis,
        cst_pis: item.cstPis,
        valor_cofins: item.valorCofins,
        cst_cofins: item.cstCofins,
        valor_cbs: item.valorCbs,
        valor_ibs: item.valorIbs,
        c_class_trib: item.cClassTrib,
        c_ativ_sn: item.cAtivSN,
        p_ibs_sn: item.pIBSSN,
        p_cbs_sn: item.pCBSSN,
        imposto_bruto: item.impostoBruto,
      })),
      p_parcelas: extraida.parcelas.map((parcela) => ({
        numero_duplicata: parcela.numeroDuplicata,
        data_vencimento: parcela.dataVencimento,
        valor: parcela.valor,
      })),
      p_pagamentos: extraida.pagamentos.map((pagamento) => ({
        indicador_pagamento: pagamento.indicadorPagamento,
        forma_pagamento: pagamento.formaPagamento,
        valor: pagamento.valor,
      })),
    });
    if (error) throw new InternalServerErrorException(`Falha ao gravar nota fiscal: ${error.message}`);
    return data as string;
  }

  async buscarPorChave(empresaId: string, chaveAcesso: string): Promise<NotaFiscalResumo | null> {
    const { data, error } = await this.supabase.admin
      .from('notas_fiscais')
      .select(COLUNAS_NOTA)
      .eq('empresa_id', empresaId)
      .eq('chave_acesso', chaveAcesso)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar nota fiscal por chave: ${error.message}`);
    return data ? this.mapearNota(data as LinhaNota) : null;
  }

  async listarPendentes(empresaId: string): Promise<NotaFiscalResumo[]> {
    const { data, error } = await this.supabase.admin
      .from('notas_fiscais')
      .select(COLUNAS_NOTA)
      .eq('empresa_id', empresaId)
      .eq('status', 'capturada')
      .order('data_emissao', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao listar notas fiscais pendentes: ${error.message}`);
    return (data as LinhaNota[]).map((linha) => this.mapearNota(linha));
  }

  async listarPorPeriodo(empresaId: string, dataInicio: string, dataFim: string): Promise<NotaFiscalResumo[]> {
    const { data, error } = await this.supabase.admin
      .from('notas_fiscais')
      .select(COLUNAS_NOTA)
      .eq('empresa_id', empresaId)
      .gte('data_emissao', dataInicio)
      .lte('data_emissao', dataFim)
      .order('data_emissao', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao listar notas fiscais do período: ${error.message}`);
    return (data as LinhaNota[]).map((linha) => this.mapearNota(linha));
  }

  async listarItensPorNotas(notaIds: string[]): Promise<ItemNotaFiscalPersistido[]> {
    if (notaIds.length === 0) return [];
    const { data, error } = await this.supabase.admin.from('notas_fiscais_itens').select(COLUNAS_ITEM).in('nota_fiscal_id', notaIds);
    if (error) throw new InternalServerErrorException(`Falha ao listar itens das notas fiscais: ${error.message}`);
    return (data as LinhaItem[]).map((linha) => this.mapearItem(linha));
  }

  async obterDetalhe(id: string, empresaId: string): Promise<NotaFiscalDetalhe | null> {
    const { data, error } = await this.supabase.admin.from('notas_fiscais').select(COLUNAS_NOTA).eq('id', id).eq('empresa_id', empresaId).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar nota fiscal: ${error.message}`);
    if (!data) return null;

    const [itens, parcelas, pagamentos] = await Promise.all([
      this.supabase.admin.from('notas_fiscais_itens').select(COLUNAS_ITEM).eq('nota_fiscal_id', id).order('numero_item'),
      this.supabase.admin.from('notas_fiscais_parcelas').select(COLUNAS_PARCELA).eq('nota_fiscal_id', id).order('numero_duplicata'),
      this.supabase.admin.from('notas_fiscais_pagamentos').select(COLUNAS_PAGAMENTO).eq('nota_fiscal_id', id),
    ]);
    if (itens.error) throw new InternalServerErrorException(`Falha ao buscar itens da nota fiscal: ${itens.error.message}`);
    if (parcelas.error) throw new InternalServerErrorException(`Falha ao buscar parcelas da nota fiscal: ${parcelas.error.message}`);
    if (pagamentos.error) throw new InternalServerErrorException(`Falha ao buscar pagamentos da nota fiscal: ${pagamentos.error.message}`);

    return {
      ...this.mapearNota(data as LinhaNota),
      itens: (itens.data as LinhaItem[]).map((linha) => this.mapearItem(linha)),
      parcelas: (parcelas.data as LinhaParcela[]).map((linha) => this.mapearParcela(linha)),
      pagamentos: (pagamentos.data as LinhaPagamento[]).map((linha) => this.mapearPagamento(linha)),
    };
  }

  async marcarAprovada(id: string, aprovadoPor: string, contaPagarId: string | null, contaReceberId: string | null): Promise<void> {
    const { error } = await this.supabase.admin
      .from('notas_fiscais')
      .update({
        status: 'aprovada',
        aprovado_por: aprovadoPor,
        aprovado_em: new Date().toISOString(),
        conta_pagar_id: contaPagarId,
        conta_receber_id: contaReceberId,
      })
      .eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao aprovar nota fiscal: ${error.message}`);
  }

  async marcarRejeitada(id: string, motivoRejeicao: string): Promise<void> {
    const { error } = await this.supabase.admin.from('notas_fiscais').update({ status: 'rejeitada', motivo_rejeicao: motivoRejeicao }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao rejeitar nota fiscal: ${error.message}`);
  }

  async buscarConfiguracaoLancamentos(empresaId: string): Promise<ConfiguracaoLancamentosNf | null> {
    const { data, error } = await this.supabase.admin
      .from('configuracoes_lancamentos_notas_fiscais')
      .select(
        'empresa_id, conta_patrimonial_entrada_id, conta_resultado_entrada_id, conta_patrimonial_saida_id, conta_resultado_saida_id, conta_recebimento_vista_id',
      )
      .eq('empresa_id', empresaId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar configuração de lançamentos: ${error.message}`);
    if (!data) return null;
    const linha = data as LinhaConfig;
    return {
      empresaId: linha.empresa_id,
      contaPatrimonialEntradaId: linha.conta_patrimonial_entrada_id,
      contaResultadoEntradaId: linha.conta_resultado_entrada_id,
      contaPatrimonialSaidaId: linha.conta_patrimonial_saida_id,
      contaResultadoSaidaId: linha.conta_resultado_saida_id,
      contaRecebimentoVistaId: linha.conta_recebimento_vista_id,
    };
  }

  async salvarConfiguracaoLancamentos(dados: DadosSalvarConfiguracaoLancamentosNf): Promise<void> {
    const { error } = await this.supabase.admin.from('configuracoes_lancamentos_notas_fiscais').upsert({
      empresa_id: dados.empresaId,
      conta_patrimonial_entrada_id: dados.contaPatrimonialEntradaId,
      conta_resultado_entrada_id: dados.contaResultadoEntradaId,
      conta_patrimonial_saida_id: dados.contaPatrimonialSaidaId,
      conta_resultado_saida_id: dados.contaResultadoSaidaId,
      conta_recebimento_vista_id: dados.contaRecebimentoVistaId,
      atualizado_por: dados.atualizadoPor,
      atualizado_em: new Date().toISOString(),
    });
    if (error) throw new InternalServerErrorException(`Falha ao salvar configuração de lançamentos: ${error.message}`);
  }

  private mapearNota(linha: LinhaNota): NotaFiscalResumo {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      chaveAcesso: linha.chave_acesso,
      modelo: linha.modelo,
      direcao: linha.direcao,
      numero: linha.numero,
      serie: linha.serie,
      dataEmissao: linha.data_emissao,
      cStat: linha.c_stat,
      emitenteCnpj: linha.emitente_cnpj,
      emitenteNome: linha.emitente_nome,
      destinatarioDocumento: linha.destinatario_documento,
      destinatarioNome: linha.destinatario_nome,
      valorTotal: linha.valor_total,
      fornecedorId: linha.fornecedor_id,
      clienteId: linha.cliente_id,
      contaPagarId: linha.conta_pagar_id,
      contaReceberId: linha.conta_receber_id,
      status: linha.status,
      xmlStorageRef: linha.xml_storage_ref,
      motivoRejeicao: linha.motivo_rejeicao,
      aprovadoPor: linha.aprovado_por,
      aprovadoEm: linha.aprovado_em,
      criadoEm: linha.criado_em,
    };
  }

  private mapearItem(linha: LinhaItem): ItemNotaFiscalPersistido {
    return {
      id: linha.id,
      notaFiscalId: linha.nota_fiscal_id,
      numeroItem: linha.numero_item,
      codigoProduto: linha.codigo_produto,
      descricao: linha.descricao,
      ncm: linha.ncm,
      cest: linha.cest,
      cfop: linha.cfop,
      quantidade: linha.quantidade,
      valorUnitario: linha.valor_unitario,
      valorTotal: linha.valor_total,
      cstCsosn: linha.cst_csosn,
      valorIcms: linha.valor_icms,
      valorIcmsSt: linha.valor_icms_st,
      valorPis: linha.valor_pis,
      cstPis: linha.cst_pis,
      valorCofins: linha.valor_cofins,
      cstCofins: linha.cst_cofins,
      valorCbs: linha.valor_cbs,
      valorIbs: linha.valor_ibs,
      cClassTrib: linha.c_class_trib,
      cAtivSN: linha.c_ativ_sn,
      pIBSSN: linha.p_ibs_sn,
      pCBSSN: linha.p_cbs_sn,
      impostoBruto: linha.imposto_bruto,
    };
  }

  private mapearParcela(linha: LinhaParcela): ParcelaNotaFiscalPersistida {
    return {
      id: linha.id,
      numeroDuplicata: linha.numero_duplicata,
      dataVencimento: linha.data_vencimento,
      valor: linha.valor,
    };
  }

  private mapearPagamento(linha: LinhaPagamento): PagamentoNotaFiscalPersistido {
    return {
      id: linha.id,
      indicadorPagamento: linha.indicador_pagamento as PagamentoNotaFiscalPersistido['indicadorPagamento'],
      formaPagamento: linha.forma_pagamento,
      valor: linha.valor,
    };
  }
}
