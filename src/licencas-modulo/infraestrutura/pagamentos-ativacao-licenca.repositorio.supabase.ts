import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  DadosNovoPagamentoAtivacao,
  PagamentoAtivacaoLicenca,
  PagamentosAtivacaoLicencaRepositorioPort,
  StatusPagamentoAtivacaoLicenca,
} from '../aplicacao/portas/pagamentos-ativacao-licenca-repositorio.port';

interface Linha {
  id: string;
  licenca_id: string;
  contador_id: string;
  empresa_id: string;
  plano_revenda_id: string;
  valor_total: number;
  platform_amount: number;
  seller_amount: number;
  metodo: 'pix' | 'cartao';
  pagbank_order_id: string | null;
  pix_code: string | null;
  pix_qr_url: string | null;
  status: StatusPagamentoAtivacaoLicenca;
}

const COLUNAS =
  'id, licenca_id, contador_id, empresa_id, plano_revenda_id, valor_total, platform_amount, seller_amount, metodo, pagbank_order_id, pix_code, pix_qr_url, status';

@Injectable()
export class PagamentosAtivacaoLicencaRepositorioSupabase implements PagamentosAtivacaoLicencaRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoPagamentoAtivacao): Promise<PagamentoAtivacaoLicenca> {
    const { data, error } = await this.supabase.admin
      .from('pagamentos_ativacao_licenca')
      .insert({
        licenca_id: dados.licencaId,
        contador_id: dados.contadorId,
        empresa_id: dados.empresaId,
        plano_revenda_id: dados.planoRevendaId,
        valor_total: dados.valorTotal,
        platform_amount: dados.platformAmount,
        seller_amount: dados.sellerAmount,
        metodo: dados.metodo,
        split_ativo: true,
      })
      .select(COLUNAS)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar pagamento de ativação: ${error?.message}`);
    }
    return this.mapear(data as Linha);
  }

  async obterPendentePorLicenca(licencaId: string): Promise<PagamentoAtivacaoLicenca | null> {
    const { data, error } = await this.supabase.admin
      .from('pagamentos_ativacao_licenca')
      .select(COLUNAS)
      .eq('licenca_id', licencaId)
      .eq('status', 'pendente')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar pagamento pendente: ${error.message}`);
    }
    return data ? this.mapear(data as Linha) : null;
  }

  async obterPorPagbankOrderId(pagbankOrderId: string): Promise<PagamentoAtivacaoLicenca | null> {
    const { data, error } = await this.supabase.admin
      .from('pagamentos_ativacao_licenca')
      .select(COLUNAS)
      .eq('pagbank_order_id', pagbankOrderId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar pagamento por ordem PagBank: ${error.message}`);
    }
    return data ? this.mapear(data as Linha) : null;
  }

  async definirDadosPix(id: string, dados: { pagbankOrderId: string; pixCode: string | null; pixQrUrl: string | null }): Promise<void> {
    const { error } = await this.supabase.admin
      .from('pagamentos_ativacao_licenca')
      .update({ pagbank_order_id: dados.pagbankOrderId, pix_code: dados.pixCode, pix_qr_url: dados.pixQrUrl })
      .eq('id', id);
    if (error) {
      throw new InternalServerErrorException(`Falha ao gravar dados do PIX: ${error.message}`);
    }
  }

  async listarPendentesPorEmpresa(empresaId: string): Promise<PagamentoAtivacaoLicenca[]> {
    const { data, error } = await this.supabase.admin
      .from('pagamentos_ativacao_licenca')
      .select(COLUNAS)
      .eq('empresa_id', empresaId)
      .eq('status', 'pendente')
      .order('criado_em', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar pendências de pagamento: ${error.message}`);
    }
    return (data as Linha[]).map((linha) => this.mapear(linha));
  }

  async marcarPago(id: string, pagbankChargeId: string | null): Promise<void> {
    const { error } = await this.supabase.admin
      .from('pagamentos_ativacao_licenca')
      .update({ status: 'pago', pagbank_charge_id: pagbankChargeId, pago_em: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      throw new InternalServerErrorException(`Falha ao marcar pagamento como pago: ${error.message}`);
    }
  }

  async marcarFalhou(id: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('pagamentos_ativacao_licenca')
      .update({ status: 'falhou' })
      .eq('id', id);
    if (error) {
      throw new InternalServerErrorException(`Falha ao marcar pagamento como falhou: ${error.message}`);
    }
  }

  private mapear(linha: Linha): PagamentoAtivacaoLicenca {
    return {
      id: linha.id,
      licencaId: linha.licenca_id,
      contadorId: linha.contador_id,
      empresaId: linha.empresa_id,
      planoRevendaId: linha.plano_revenda_id,
      valorTotal: Number(linha.valor_total),
      platformAmount: Number(linha.platform_amount),
      sellerAmount: Number(linha.seller_amount),
      metodo: linha.metodo,
      pagbankOrderId: linha.pagbank_order_id,
      pixCode: linha.pix_code,
      pixQrUrl: linha.pix_qr_url,
      status: linha.status,
    };
  }
}
