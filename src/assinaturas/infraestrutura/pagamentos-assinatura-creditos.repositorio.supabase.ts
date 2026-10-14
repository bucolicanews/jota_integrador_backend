import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  DadosNovoPagamentoAssinaturaCredito,
  PagamentoAssinaturaCredito,
  PagamentosAssinaturaCreditosRepositorioPort,
  StatusPagamentoAssinaturaCredito,
} from '../aplicacao/portas/pagamentos-assinatura-creditos-repositorio.port';

interface Linha {
  id: string;
  contador_id: string;
  empresa_id: string;
  plano_id: string;
  plano_revenda_id: string;
  valor_total: number;
  platform_amount: number;
  seller_amount: number;
  metodo: 'pix' | 'cartao';
  pagbank_order_id: string | null;
  pix_code: string | null;
  pix_qr_url: string | null;
  status: StatusPagamentoAssinaturaCredito;
}

const COLUNAS =
  'id, contador_id, empresa_id, plano_id, plano_revenda_id, valor_total, platform_amount, seller_amount, metodo, pagbank_order_id, pix_code, pix_qr_url, status';

@Injectable()
export class PagamentosAssinaturaCreditosRepositorioSupabase implements PagamentosAssinaturaCreditosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoPagamentoAssinaturaCredito): Promise<PagamentoAssinaturaCredito> {
    const { data, error } = await this.supabase.admin
      .from('pagamentos_assinatura_creditos')
      .insert({
        contador_id: dados.contadorId,
        empresa_id: dados.empresaId,
        plano_id: dados.planoId,
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
      throw new InternalServerErrorException(`Falha ao criar pagamento de assinatura: ${error?.message}`);
    }
    return this.mapear(data as Linha);
  }

  async obterPendentePorEmpresa(empresaId: string): Promise<PagamentoAssinaturaCredito | null> {
    const { data, error } = await this.supabase.admin
      .from('pagamentos_assinatura_creditos')
      .select(COLUNAS)
      .eq('empresa_id', empresaId)
      .eq('status', 'pendente')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar pagamento pendente: ${error.message}`);
    }
    return data ? this.mapear(data as Linha) : null;
  }

  async obterPorPagbankOrderId(pagbankOrderId: string): Promise<PagamentoAssinaturaCredito | null> {
    const { data, error } = await this.supabase.admin
      .from('pagamentos_assinatura_creditos')
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
      .from('pagamentos_assinatura_creditos')
      .update({ pagbank_order_id: dados.pagbankOrderId, pix_code: dados.pixCode, pix_qr_url: dados.pixQrUrl })
      .eq('id', id);
    if (error) {
      throw new InternalServerErrorException(`Falha ao gravar dados do PIX: ${error.message}`);
    }
  }

  async marcarPago(id: string, pagbankChargeId: string | null): Promise<void> {
    const { error } = await this.supabase.admin
      .from('pagamentos_assinatura_creditos')
      .update({ status: 'pago', pagbank_charge_id: pagbankChargeId, pago_em: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      throw new InternalServerErrorException(`Falha ao marcar pagamento como pago: ${error.message}`);
    }
  }

  async marcarFalhou(id: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('pagamentos_assinatura_creditos')
      .update({ status: 'falhou' })
      .eq('id', id);
    if (error) {
      throw new InternalServerErrorException(`Falha ao marcar pagamento como falhou: ${error.message}`);
    }
  }

  private mapear(linha: Linha): PagamentoAssinaturaCredito {
    return {
      id: linha.id,
      contadorId: linha.contador_id,
      empresaId: linha.empresa_id,
      planoId: linha.plano_id,
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
