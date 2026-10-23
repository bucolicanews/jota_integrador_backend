import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  DadosNovoPagamentoCreditoAvulso,
  PagamentoCreditoAvulso,
  PagamentosCreditosAvulsosRepositorioPort,
  StatusPagamentoCreditoAvulso,
} from '../aplicacao/portas/pagamentos-creditos-avulsos-repositorio.port';

interface Linha {
  id: string;
  empresa_id: string;
  pacote_id: string | null;
  quantidade_creditos: number;
  valor_total: number;
  contador_id: string | null;
  plano_revenda_id: string | null;
  platform_amount: number | null;
  seller_amount: number | null;
  pagbank_order_id: string | null;
  pix_code: string | null;
  pix_qr_url: string | null;
  status: StatusPagamentoCreditoAvulso;
}

const COLUNAS =
  'id, empresa_id, pacote_id, quantidade_creditos, valor_total, contador_id, plano_revenda_id, platform_amount, seller_amount, pagbank_order_id, pix_code, pix_qr_url, status';

@Injectable()
export class PagamentosCreditosAvulsosRepositorioSupabase implements PagamentosCreditosAvulsosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoPagamentoCreditoAvulso): Promise<PagamentoCreditoAvulso> {
    const { data, error } = await this.supabase.admin
      .from('pagamentos_creditos_avulsos')
      .insert({
        empresa_id: dados.empresaId,
        pacote_id: dados.pacoteId ?? null,
        quantidade_creditos: dados.quantidadeCreditos,
        valor_total: dados.valorTotal,
        contador_id: dados.contadorId ?? null,
        plano_revenda_id: dados.planoRevendaId ?? null,
        platform_amount: dados.platformAmount ?? null,
        seller_amount: dados.sellerAmount ?? null,
      })
      .select(COLUNAS)
      .single();
    if (error || !data) throw new InternalServerErrorException(`Falha ao criar pagamento de crédito avulso: ${error?.message}`);
    return this.mapear(data as Linha);
  }

  async obterPendentePorEmpresa(empresaId: string): Promise<PagamentoCreditoAvulso | null> {
    const { data, error } = await this.supabase.admin
      .from('pagamentos_creditos_avulsos')
      .select(COLUNAS)
      .eq('empresa_id', empresaId)
      .eq('status', 'pendente')
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar pagamento pendente: ${error.message}`);
    return data ? this.mapear(data as Linha) : null;
  }

  async obterPorPagbankOrderId(pagbankOrderId: string): Promise<PagamentoCreditoAvulso | null> {
    const { data, error } = await this.supabase.admin
      .from('pagamentos_creditos_avulsos')
      .select(COLUNAS)
      .eq('pagbank_order_id', pagbankOrderId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar pagamento por ordem PagBank: ${error.message}`);
    return data ? this.mapear(data as Linha) : null;
  }

  async definirDadosPix(id: string, dados: { pagbankOrderId: string; pixCode: string | null; pixQrUrl: string | null }): Promise<void> {
    const { error } = await this.supabase.admin
      .from('pagamentos_creditos_avulsos')
      .update({ pagbank_order_id: dados.pagbankOrderId, pix_code: dados.pixCode, pix_qr_url: dados.pixQrUrl })
      .eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao gravar dados do PIX: ${error.message}`);
  }

  async marcarPago(id: string, pagbankChargeId: string | null): Promise<void> {
    const { error } = await this.supabase.admin
      .from('pagamentos_creditos_avulsos')
      .update({ status: 'pago', pagbank_charge_id: pagbankChargeId, pago_em: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao marcar pagamento como pago: ${error.message}`);
  }

  async marcarFalhou(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('pagamentos_creditos_avulsos').update({ status: 'falhou' }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao marcar pagamento como falhou: ${error.message}`);
  }

  private mapear(linha: Linha): PagamentoCreditoAvulso {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      pacoteId: linha.pacote_id,
      quantidadeCreditos: linha.quantidade_creditos,
      valorTotal: Number(linha.valor_total),
      contadorId: linha.contador_id,
      planoRevendaId: linha.plano_revenda_id,
      platformAmount: linha.platform_amount !== null ? Number(linha.platform_amount) : null,
      sellerAmount: linha.seller_amount !== null ? Number(linha.seller_amount) : null,
      pagbankOrderId: linha.pagbank_order_id,
      pixCode: linha.pix_code,
      pixQrUrl: linha.pix_qr_url,
      status: linha.status,
    };
  }
}
