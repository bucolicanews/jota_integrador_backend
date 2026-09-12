import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { calcularStatus, gerarParcelas } from '../dominio/conta-pagar';
import {
  ContaPagar,
  ContasPagarRepositorioPort,
  DadosNovaContaPagar,
  DadosNovoPagamentoCP,
  FiltroContasPagar,
  PagamentoContaPagar,
  ParcelaContaPagar,
} from '../aplicacao/portas/contas-pagar-repositorio.port';

interface LinhaConta {
  id: string;
  empresa_id: string;
  fornecedor_id: string | null;
  fornecedor: string;
  descricao: string;
  valor_total: number;
  data_emissao: string;
  conta_patrimonial_id: string;
  conta_resultado_id: string;
  cancelada: boolean;
  criado_por: string;
  criado_em: string;
}

interface LinhaParcela {
  id: string;
  conta_pagar_id: string;
  empresa_id: string;
  numero_parcela: number;
  valor_parcela: number;
  data_vencimento: string;
  cancelada: boolean;
}

interface LinhaPagamento {
  id: string;
  parcela_id: string;
  empresa_id: string;
  conta_bancaria_id: string;
  valor_pago: number;
  data_pagamento: string;
  lancamento_id: string;
  estornado: boolean;
  criado_por: string;
  criado_em: string;
}

const COLUNAS_CONTA = 'id, empresa_id, fornecedor_id, fornecedor, descricao, valor_total, data_emissao, conta_patrimonial_id, conta_resultado_id, cancelada, criado_por, criado_em';
const COLUNAS_PARCELA = 'id, conta_pagar_id, empresa_id, numero_parcela, valor_parcela, data_vencimento, cancelada';
const COLUNAS_PAGAMENTO = 'id, parcela_id, empresa_id, conta_bancaria_id, valor_pago, data_pagamento, lancamento_id, estornado, criado_por, criado_em';

@Injectable()
export class ContasPagarRepositorioSupabase implements ContasPagarRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criarComParcelas(dados: DadosNovaContaPagar): Promise<string> {
    const parcelas = gerarParcelas(dados.modo, dados.valor, dados.quantidadeParcelas, dados.primeiroVencimento, dados.intervaloDias);

    const { data, error } = await this.supabase.admin.rpc('criar_conta_pagar_com_parcelas', {
      p_empresa_id: dados.empresaId,
      p_fornecedor: dados.fornecedor,
      p_descricao: dados.descricao,
      p_conta_patrimonial_id: dados.contaPatrimonialId,
      p_conta_resultado_id: dados.contaResultadoId,
      p_data_emissao: dados.dataEmissao,
      p_criado_por: dados.criadoPor,
      p_parcelas: parcelas.map((p) => ({ numero_parcela: p.numeroParcela, valor_parcela: p.valorParcela, data_vencimento: p.dataVencimento })),
    });

    if (error) throw new BadRequestException(error.message);
    const contaId = data as string;

    if (dados.fornecedorId) {
      const { error: erroVinculo } = await this.supabase.admin.from('contas_pagar').update({ fornecedor_id: dados.fornecedorId }).eq('id', contaId);
      if (erroVinculo) throw new InternalServerErrorException(`Conta criada, mas falha ao vincular fornecedor: ${erroVinculo.message}`);
    }

    return contaId;
  }

  async listarPorEmpresa(empresaId: string, filtro?: FiltroContasPagar): Promise<ContaPagar[]> {
    const { data, error } = await this.supabase.admin.from('contas_pagar').select(COLUNAS_CONTA).eq('empresa_id', empresaId).order('data_emissao', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao listar contas a pagar: ${error.message}`);

    const contas = await this.montarContasComParcelas(data as LinhaConta[]);
    return filtro?.status ? contas.filter((c) => c.status === filtro.status) : contas;
  }

  async obterPorId(id: string): Promise<ContaPagar | null> {
    const { data, error } = await this.supabase.admin.from('contas_pagar').select(COLUNAS_CONTA).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar conta a pagar: ${error.message}`);
    if (!data) return null;
    const [conta] = await this.montarContasComParcelas([data as LinhaConta]);
    return conta;
  }

  async cancelar(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('contas_pagar').update({ cancelada: true }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao cancelar conta a pagar: ${error.message}`);
  }

  async obterParcela(id: string): Promise<ParcelaContaPagar | null> {
    const { data, error } = await this.supabase.admin.from('parcelas_contas_pagar').select(COLUNAS_PARCELA).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar parcela: ${error.message}`);
    if (!data) return null;

    const pagamentos = await this.buscarPagamentosDeVarias([id]);
    return this.mapearParcela(data as LinhaParcela, pagamentos.get(id) ?? []);
  }

  async criarPagamento(dados: DadosNovoPagamentoCP): Promise<PagamentoContaPagar> {
    const { data, error } = await this.supabase.admin
      .from('pagamentos_contas_pagar')
      .insert({
        parcela_id: dados.parcelaId,
        empresa_id: dados.empresaId,
        conta_bancaria_id: dados.contaBancariaId,
        valor_pago: dados.valorPago,
        data_pagamento: dados.dataPagamento,
        lancamento_id: dados.lancamentoId,
        criado_por: dados.criadoPor,
      })
      .select(COLUNAS_PAGAMENTO)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao registrar pagamento: ${error.message}`);
    return this.mapearPagamento(data as LinhaPagamento);
  }

  async listarPagamentosDaParcela(parcelaId: string): Promise<PagamentoContaPagar[]> {
    const { data, error } = await this.supabase.admin
      .from('pagamentos_contas_pagar')
      .select(COLUNAS_PAGAMENTO)
      .eq('parcela_id', parcelaId)
      .order('criado_em', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao listar pagamentos da parcela: ${error.message}`);
    return (data as LinhaPagamento[]).map((linha) => this.mapearPagamento(linha));
  }

  async obterPagamento(id: string): Promise<PagamentoContaPagar | null> {
    const { data, error } = await this.supabase.admin.from('pagamentos_contas_pagar').select(COLUNAS_PAGAMENTO).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar pagamento: ${error.message}`);
    return data ? this.mapearPagamento(data as LinhaPagamento) : null;
  }

  async marcarPagamentoEstornado(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('pagamentos_contas_pagar').update({ estornado: true }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao estornar pagamento: ${error.message}`);
  }

  // ---------------- Helpers ----------------

  private async montarContasComParcelas(linhasConta: LinhaConta[]): Promise<ContaPagar[]> {
    if (linhasConta.length === 0) return [];
    const contaIds = linhasConta.map((c) => c.id);

    const { data: linhasParcela, error: erroParcelas } = await this.supabase.admin
      .from('parcelas_contas_pagar')
      .select(COLUNAS_PARCELA)
      .in('conta_pagar_id', contaIds)
      .order('numero_parcela');
    if (erroParcelas) throw new InternalServerErrorException(`Falha ao buscar parcelas: ${erroParcelas.message}`);

    const parcelas = linhasParcela as LinhaParcela[];
    const pagamentosPorParcela = await this.buscarPagamentosDeVarias(parcelas.map((p) => p.id));

    const parcelasPorConta = new Map<string, ParcelaContaPagar[]>();
    for (const linhaParcela of parcelas) {
      const parcela = this.mapearParcela(linhaParcela, pagamentosPorParcela.get(linhaParcela.id) ?? []);
      const lista = parcelasPorConta.get(linhaParcela.conta_pagar_id) ?? [];
      lista.push(parcela);
      parcelasPorConta.set(linhaParcela.conta_pagar_id, lista);
    }

    return linhasConta.map((linha) => {
      const parcelasDaConta = parcelasPorConta.get(linha.id) ?? [];
      const valorPago = parcelasDaConta.reduce((soma, p) => soma + p.valorPago, 0);
      return {
        id: linha.id,
        empresaId: linha.empresa_id,
        fornecedorId: linha.fornecedor_id,
        fornecedor: linha.fornecedor,
        descricao: linha.descricao,
        valorTotal: Number(linha.valor_total),
        dataEmissao: linha.data_emissao,
        contaPatrimonialId: linha.conta_patrimonial_id,
        contaResultadoId: linha.conta_resultado_id,
        cancelada: linha.cancelada,
        criadoPor: linha.criado_por,
        criadoEm: linha.criado_em,
        valorPago,
        status: calcularStatus(Number(linha.valor_total), valorPago, linha.cancelada),
        parcelas: parcelasDaConta,
      };
    });
  }

  private async buscarPagamentosDeVarias(parcelaIds: string[]): Promise<Map<string, LinhaPagamento[]>> {
    const mapa = new Map<string, LinhaPagamento[]>();
    if (parcelaIds.length === 0) return mapa;

    const { data, error } = await this.supabase.admin
      .from('pagamentos_contas_pagar')
      .select(COLUNAS_PAGAMENTO)
      .in('parcela_id', parcelaIds)
      .eq('estornado', false);
    if (error) throw new InternalServerErrorException(`Falha ao buscar pagamentos: ${error.message}`);

    for (const linha of data as LinhaPagamento[]) {
      const lista = mapa.get(linha.parcela_id) ?? [];
      lista.push(linha);
      mapa.set(linha.parcela_id, lista);
    }
    return mapa;
  }

  private mapearParcela(linha: LinhaParcela, pagamentos: LinhaPagamento[]): ParcelaContaPagar {
    const valorPago = pagamentos.reduce((soma, p) => soma + Number(p.valor_pago), 0);
    return {
      id: linha.id,
      contaPagarId: linha.conta_pagar_id,
      empresaId: linha.empresa_id,
      numeroParcela: linha.numero_parcela,
      valorParcela: Number(linha.valor_parcela),
      dataVencimento: linha.data_vencimento,
      cancelada: linha.cancelada,
      valorPago,
      status: calcularStatus(Number(linha.valor_parcela), valorPago, linha.cancelada),
    };
  }

  private mapearPagamento(linha: LinhaPagamento): PagamentoContaPagar {
    return {
      id: linha.id,
      parcelaId: linha.parcela_id,
      empresaId: linha.empresa_id,
      contaBancariaId: linha.conta_bancaria_id,
      valorPago: Number(linha.valor_pago),
      dataPagamento: linha.data_pagamento,
      lancamentoId: linha.lancamento_id,
      estornado: linha.estornado,
      criadoPor: linha.criado_por,
      criadoEm: linha.criado_em,
    };
  }
}
