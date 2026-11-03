import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { StatusCobranca } from '../dominio/cobranca-honorario';
import {
  CobrancaHonorario,
  CobrancasHonorariosRepositorioPort,
  DadosAtualizacaoPagamento,
  DadosNovaCobranca,
} from '../aplicacao/portas/cobrancas-honorarios-repositorio.port';

interface LinhaCobranca {
  id: string;
  contador_id: string;
  empresa_id: string;
  descricao: string;
  valor: number;
  comissao_pct: number;
  comissao_valor: number;
  metodo: 'pix' | 'cartao' | null;
  pagbank_order_id: string | null;
  pagbank_charge_id: string | null;
  pix_code: string | null;
  pix_qr_url: string | null;
  status: StatusCobranca;
  criado_em: string;
  pago_em: string | null;
}

const COLUNAS_SELECT =
  'id, contador_id, empresa_id, descricao, valor, comissao_pct, comissao_valor, metodo, pagbank_order_id, pagbank_charge_id, pix_code, pix_qr_url, status, criado_em, pago_em';

@Injectable()
export class CobrancasHonorariosRepositorioSupabase implements CobrancasHonorariosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovaCobranca): Promise<CobrancaHonorario> {
    // comissao_pct/comissao_valor NÃO vão no insert -- o trigger definir_comissao_honorario
    // (SECURITY DEFINER) calcula a partir da config global e sobrescreve qualquer coisa
    // que viesse daqui (docs/SEGURANCA.md §7: comissão nunca aceita do cliente).
    const { data, error } = await this.supabase.admin
      .from('cobrancas_honorarios')
      .insert({
        contador_id: dados.contadorId,
        empresa_id: dados.empresaId,
        descricao: dados.descricao,
        valor: dados.valor,
        metodo: dados.metodo,
      })
      .select(COLUNAS_SELECT)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar cobrança de honorário: ${error?.message}`);
    }
    return this.mapear(data as LinhaCobranca);
  }

  async buscarPorId(id: string): Promise<CobrancaHonorario | null> {
    const { data, error } = await this.supabase.admin
      .from('cobrancas_honorarios')
      .select(COLUNAS_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar cobrança: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaCobranca) : null;
  }

  async buscarPorPagbankOrderId(pagbankOrderId: string): Promise<CobrancaHonorario | null> {
    const { data, error } = await this.supabase.admin
      .from('cobrancas_honorarios')
      .select(COLUNAS_SELECT)
      .eq('pagbank_order_id', pagbankOrderId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar cobrança por ordem PagBank: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaCobranca) : null;
  }

  async listarPorContador(contadorId: string): Promise<CobrancaHonorario[]> {
    const { data, error } = await this.supabase.admin
      .from('cobrancas_honorarios')
      .select(COLUNAS_SELECT)
      .eq('contador_id', contadorId)
      .order('criado_em', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar cobranças do contador: ${error.message}`);
    }
    return (data as LinhaCobranca[]).map((linha) => this.mapear(linha));
  }

  async listarPorEmpresa(empresaId: string): Promise<CobrancaHonorario[]> {
    const { data, error } = await this.supabase.admin
      .from('cobrancas_honorarios')
      .select(COLUNAS_SELECT)
      .eq('empresa_id', empresaId)
      .order('criado_em', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar cobranças da empresa: ${error.message}`);
    }
    return (data as LinhaCobranca[]).map((linha) => this.mapear(linha));
  }

  async definirDadosPix(id: string, dados: { pagbankOrderId: string; pixCode: string | null; pixQrUrl: string | null }): Promise<void> {
    const { error } = await this.supabase.admin
      .from('cobrancas_honorarios')
      .update({ pagbank_order_id: dados.pagbankOrderId, pix_code: dados.pixCode, pix_qr_url: dados.pixQrUrl })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao gravar dados da ordem PagBank: ${error.message}`);
    }
  }

  async atualizarPagamento(id: string, dados: DadosAtualizacaoPagamento): Promise<void> {
    const { error } = await this.supabase.admin
      .from('cobrancas_honorarios')
      .update({
        status: dados.status,
        pagbank_charge_id: dados.pagbankChargeId,
        pago_em: dados.pagoEm,
      })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar pagamento da cobrança: ${error.message}`);
    }
  }

  async marcarFalhou(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('cobrancas_honorarios').update({ status: 'falhou' }).eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao marcar cobrança como falhou: ${error.message}`);
    }
  }

  private mapear(linha: LinhaCobranca): CobrancaHonorario {
    return {
      id: linha.id,
      contadorId: linha.contador_id,
      empresaId: linha.empresa_id,
      descricao: linha.descricao,
      valor: Number(linha.valor),
      comissaoPct: Number(linha.comissao_pct),
      comissaoValor: Number(linha.comissao_valor),
      metodo: linha.metodo,
      pagbankOrderId: linha.pagbank_order_id,
      pagbankChargeId: linha.pagbank_charge_id,
      pixCode: linha.pix_code,
      pixQrUrl: linha.pix_qr_url,
      status: linha.status,
      criadoEm: linha.criado_em,
      pagoEm: linha.pago_em,
    };
  }
}
