import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { StatusLinkPagamento } from '../dominio/link-pagamento-parcela';
import {
  DadosConfirmacaoPagamento,
  DadosNovoLinkPagamento,
  LinkPagamentoParcela,
  LinksPagamentoParcelaRepositorioPort,
} from '../aplicacao/portas/links-pagamento-parcela-repositorio.port';

interface LinhaLinkPagamento {
  id: string;
  parcela_id: string;
  empresa_id: string;
  cliente_id: string | null;
  valor: number;
  comissao_pct: number;
  comissao_valor: number;
  metodo: 'pix' | 'cartao';
  pagbank_order_id: string | null;
  pagbank_charge_id: string | null;
  pix_code: string | null;
  pix_qr_url: string | null;
  recebimento_id: string | null;
  status: StatusLinkPagamento;
  criado_por: string;
  criado_em: string;
  pago_em: string | null;
}

const COLUNAS_SELECT =
  'id, parcela_id, empresa_id, cliente_id, valor, comissao_pct, comissao_valor, metodo, pagbank_order_id, pagbank_charge_id, pix_code, pix_qr_url, recebimento_id, status, criado_por, criado_em, pago_em';

@Injectable()
export class LinksPagamentoParcelaRepositorioSupabase implements LinksPagamentoParcelaRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoLinkPagamento): Promise<LinkPagamentoParcela> {
    // comissao_pct/comissao_valor NÃO vão no insert -- o trigger
    // definir_comissao_link_pagamento_parcela (SECURITY DEFINER) calcula a partir da
    // config global e sobrescreve qualquer coisa que viesse daqui.
    const { data, error } = await this.supabase.admin
      .from('links_pagamento_parcela')
      .insert({
        parcela_id: dados.parcelaId,
        empresa_id: dados.empresaId,
        cliente_id: dados.clienteId,
        valor: dados.valor,
        metodo: dados.metodo,
        criado_por: dados.criadoPor,
      })
      .select(COLUNAS_SELECT)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar link de pagamento: ${error?.message}`);
    }
    return this.mapear(data as LinhaLinkPagamento);
  }

  async buscarPorId(id: string): Promise<LinkPagamentoParcela | null> {
    const { data, error } = await this.supabase.admin
      .from('links_pagamento_parcela')
      .select(COLUNAS_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar link de pagamento: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaLinkPagamento) : null;
  }

  async buscarPorPagbankOrderId(pagbankOrderId: string): Promise<LinkPagamentoParcela | null> {
    const { data, error } = await this.supabase.admin
      .from('links_pagamento_parcela')
      .select(COLUNAS_SELECT)
      .eq('pagbank_order_id', pagbankOrderId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar link de pagamento por ordem PagBank: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaLinkPagamento) : null;
  }

  async listarPorParcela(parcelaId: string): Promise<LinkPagamentoParcela[]> {
    const { data, error } = await this.supabase.admin
      .from('links_pagamento_parcela')
      .select(COLUNAS_SELECT)
      .eq('parcela_id', parcelaId)
      .order('criado_em', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar links de pagamento da parcela: ${error.message}`);
    }
    return (data as LinhaLinkPagamento[]).map((linha) => this.mapear(linha));
  }

  async definirDadosPix(id: string, dados: { pagbankOrderId: string; pixCode: string | null; pixQrUrl: string | null }): Promise<void> {
    const { error } = await this.supabase.admin
      .from('links_pagamento_parcela')
      .update({ pagbank_order_id: dados.pagbankOrderId, pix_code: dados.pixCode, pix_qr_url: dados.pixQrUrl })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao gravar dados da ordem PagBank: ${error.message}`);
    }
  }

  async confirmarPagamento(id: string, dados: DadosConfirmacaoPagamento): Promise<void> {
    const { error } = await this.supabase.admin
      .from('links_pagamento_parcela')
      .update({
        status: dados.status,
        pagbank_charge_id: dados.pagbankChargeId,
        recebimento_id: dados.recebimentoId,
        pago_em: dados.pagoEm,
      })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao confirmar pagamento do link: ${error.message}`);
    }
  }

  async marcarFalhou(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('links_pagamento_parcela').update({ status: 'falhou' }).eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao marcar link de pagamento como falhou: ${error.message}`);
    }
  }

  private mapear(linha: LinhaLinkPagamento): LinkPagamentoParcela {
    return {
      id: linha.id,
      parcelaId: linha.parcela_id,
      empresaId: linha.empresa_id,
      clienteId: linha.cliente_id,
      valor: Number(linha.valor),
      comissaoPct: Number(linha.comissao_pct),
      comissaoValor: Number(linha.comissao_valor),
      metodo: linha.metodo,
      pagbankOrderId: linha.pagbank_order_id,
      pagbankChargeId: linha.pagbank_charge_id,
      pixCode: linha.pix_code,
      pixQrUrl: linha.pix_qr_url,
      recebimentoId: linha.recebimento_id,
      status: linha.status,
      criadoPor: linha.criado_por,
      criadoEm: linha.criado_em,
      pagoEm: linha.pago_em,
    };
  }
}
