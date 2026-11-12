import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { DasItem, RegimeDas } from '../dominio/das';
import {
  ConfiguracaoLancamentosDas,
  DadosSalvarConfiguracaoLancamentosDas,
  DadosUpsertDasMei,
  DadosUpsertDasSimplesNacional,
  DasRepositorioPort,
} from '../aplicacao/portas/das-repositorio.port';

interface LinhaDasMei {
  id: string;
  empresa_id: string;
  competencia: string;
  numero_documento: string | null;
  valor: string | null;
  vencimento: string;
  status: 'pendente' | 'pago';
  pdf_storage_ref: string | null;
  pago_em: string | null;
  conta_pagar_provisao_id: string | null;
  lancamento_baixa_id: string | null;
}

interface LinhaDeclaracaoPgdas {
  id: string;
  empresa_id: string;
  competencia: string;
  numero_das: string | null;
  valor_das: string | null;
  vencimento: string;
  status: string;
  pdf_storage_ref: string | null;
  pago_em: string | null;
  conta_pagar_provisao_id: string | null;
  lancamento_baixa_id: string | null;
}

interface LinhaConfiguracaoLancamentos {
  empresa_id: string;
  conta_debito_id: string;
  conta_credito_id: string;
}

const COLUNAS_DAS_MEI =
  'id, empresa_id, competencia, numero_documento, valor, vencimento, status, pdf_storage_ref, pago_em, conta_pagar_provisao_id, lancamento_baixa_id';
const COLUNAS_DECLARACOES_PGDAS =
  'id, empresa_id, competencia, numero_das, valor_das, vencimento, status, pdf_storage_ref, pago_em, conta_pagar_provisao_id, lancamento_baixa_id';

/**
 * Implementa o port abstraindo as duas tabelas físicas (`das_mei`/`declaracoes_pgdas`)
 * atrás do DTO unificado `DasItem` -- cada método público confere o `regime` recebido e
 * só toca na tabela correspondente, nunca mistura.
 */
@Injectable()
export class DasRepositorioSupabase implements DasRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async listarPorEmpresa(empresaId: string, regime: RegimeDas): Promise<DasItem[]> {
    if (regime === 'mei') {
      const { data, error } = await this.supabase.admin
        .from('das_mei')
        .select(COLUNAS_DAS_MEI)
        .eq('empresa_id', empresaId)
        .order('competencia', { ascending: false });
      if (error) throw new InternalServerErrorException(`Falha ao listar DAS MEI: ${error.message}`);
      return (data as LinhaDasMei[]).map((linha) => this.mapearMei(linha));
    }

    const { data, error } = await this.supabase.admin
      .from('declaracoes_pgdas')
      .select(COLUNAS_DECLARACOES_PGDAS)
      .eq('empresa_id', empresaId)
      .order('competencia', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao listar declarações PGDAS: ${error.message}`);
    return (data as LinhaDeclaracaoPgdas[]).map((linha) => this.mapearSimplesNacional(linha));
  }

  async buscarPorId(id: string, regime: RegimeDas): Promise<DasItem | null> {
    if (regime === 'mei') {
      const { data, error } = await this.supabase.admin
        .from('das_mei')
        .select(COLUNAS_DAS_MEI)
        .eq('id', id)
        .maybeSingle();
      if (error) throw new InternalServerErrorException(`Falha ao buscar DAS MEI: ${error.message}`);
      return data ? this.mapearMei(data as LinhaDasMei) : null;
    }

    const { data, error } = await this.supabase.admin
      .from('declaracoes_pgdas')
      .select(COLUNAS_DECLARACOES_PGDAS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar declaração PGDAS: ${error.message}`);
    return data ? this.mapearSimplesNacional(data as LinhaDeclaracaoPgdas) : null;
  }

  async upsertMei(dados: DadosUpsertDasMei): Promise<DasItem> {
    // Insert simples + catch do erro de unique constraint -- idempotente, mesmo padrão
    // já usado em mensagens_caixa_postal (nunca sobrescreve registro existente).
    const { error: erroInsert } = await this.supabase.admin.from('das_mei').insert({
      empresa_id: dados.empresaId,
      competencia: dados.competencia,
      numero_documento: dados.numeroDocumento,
      codigo_barras: dados.codigoBarras,
      valor: dados.valor,
      vencimento: dados.vencimento,
      pdf_storage_ref: dados.pdfStorageRef,
      status: dados.dasPago ? 'pago' : 'pendente',
      pago_em: dados.dasPago ? new Date().toISOString() : null,
    });

    if (erroInsert && erroInsert.code !== '23505') {
      throw new InternalServerErrorException(`Falha ao gravar DAS MEI: ${erroInsert.message}`);
    }

    const { data, error } = await this.supabase.admin
      .from('das_mei')
      .select(COLUNAS_DAS_MEI)
      .eq('empresa_id', dados.empresaId)
      .eq('competencia', dados.competencia)
      .single();
    if (error || !data) throw new InternalServerErrorException(`Falha ao reler DAS MEI: ${error?.message}`);
    return this.mapearMei(data as LinhaDasMei);
  }

  async upsertSimplesNacional(dados: DadosUpsertDasSimplesNacional): Promise<DasItem> {
    const { error: erroInsert } = await this.supabase.admin.from('declaracoes_pgdas').insert({
      empresa_id: dados.empresaId,
      competencia: dados.competencia,
      valor_das: dados.valorDas,
      status: dados.dasPago ? 'pago' : 'pendente',
      pago_em: dados.dasPago ? new Date().toISOString() : null,
      vencimento: dados.vencimento,
      numero_das: dados.numeroDas,
      pdf_storage_ref: dados.pdfStorageRef,
    });

    if (erroInsert && erroInsert.code !== '23505') {
      throw new InternalServerErrorException(`Falha ao gravar declaração PGDAS: ${erroInsert.message}`);
    }

    const { data, error } = await this.supabase.admin
      .from('declaracoes_pgdas')
      .select(COLUNAS_DECLARACOES_PGDAS)
      .eq('empresa_id', dados.empresaId)
      .eq('competencia', dados.competencia)
      .single();
    if (error || !data) throw new InternalServerErrorException(`Falha ao reler declaração PGDAS: ${error?.message}`);
    return this.mapearSimplesNacional(data as LinhaDeclaracaoPgdas);
  }

  async listarPendentesComNumeroDocumento(empresaId: string, regime: RegimeDas): Promise<DasItem[]> {
    const todos = await this.listarPorEmpresa(empresaId, regime);
    return todos.filter((item) => item.status === 'pendente' && item.numeroDocumento);
  }

  async marcarComoPago(id: string, regime: RegimeDas, pagoEm: string): Promise<void> {
    const tabela = regime === 'mei' ? 'das_mei' : 'declaracoes_pgdas';
    const { error } = await this.supabase.admin.from(tabela).update({ status: 'pago', pago_em: pagoEm }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao marcar DAS como pago: ${error.message}`);
  }

  async atualizarPdfStorageRef(id: string, regime: RegimeDas, pdfStorageRef: string): Promise<void> {
    const tabela = regime === 'mei' ? 'das_mei' : 'declaracoes_pgdas';
    const { error } = await this.supabase.admin.from(tabela).update({ pdf_storage_ref: pdfStorageRef }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar PDF do DAS: ${error.message}`);
  }

  async atualizarSegundaVia(
    id: string,
    dados: { valorDas: number | null; vencimento: string | null; pdfSegundaViaStorageRef: string },
  ): Promise<void> {
    const campos: Record<string, unknown> = { pdf_segunda_via_storage_ref: dados.pdfSegundaViaStorageRef };
    if (dados.valorDas !== null) campos.valor_das = dados.valorDas;
    if (dados.vencimento !== null) campos.vencimento = dados.vencimento;

    const { error } = await this.supabase.admin.from('declaracoes_pgdas').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao gravar 2ª via do DAS: ${error.message}`);
  }

  private mapearMei(linha: LinhaDasMei): DasItem {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      regime: 'mei',
      competencia: linha.competencia,
      valor: linha.valor === null ? null : Number(linha.valor),
      vencimento: linha.vencimento,
      status: linha.status,
      numeroDocumento: linha.numero_documento,
      pdfStorageRef: linha.pdf_storage_ref,
      pagoEm: linha.pago_em,
      contaPagarProvisaoId: linha.conta_pagar_provisao_id,
      lancamentoBaixaId: linha.lancamento_baixa_id,
    };
  }

  private mapearSimplesNacional(linha: LinhaDeclaracaoPgdas): DasItem {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      regime: 'simples_nacional',
      competencia: linha.competencia,
      valor: linha.valor_das === null ? null : Number(linha.valor_das),
      vencimento: linha.vencimento,
      status: linha.status === 'pago' ? 'pago' : 'pendente',
      numeroDocumento: linha.numero_das,
      pdfStorageRef: linha.pdf_storage_ref,
      pagoEm: linha.pago_em,
      contaPagarProvisaoId: linha.conta_pagar_provisao_id,
      lancamentoBaixaId: linha.lancamento_baixa_id,
    };
  }

  async marcarContaPagarProvisao(id: string, regime: RegimeDas, contaPagarId: string): Promise<void> {
    const tabela = regime === 'mei' ? 'das_mei' : 'declaracoes_pgdas';
    const { error } = await this.supabase.admin.from(tabela).update({ conta_pagar_provisao_id: contaPagarId }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao gravar conta a pagar de provisão do DAS: ${error.message}`);
  }

  async marcarLancamentoBaixa(id: string, regime: RegimeDas, lancamentoId: string): Promise<void> {
    const tabela = regime === 'mei' ? 'das_mei' : 'declaracoes_pgdas';
    const { error } = await this.supabase.admin.from(tabela).update({ lancamento_baixa_id: lancamentoId }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao gravar lançamento de baixa do DAS: ${error.message}`);
  }

  async listarPendentesDeBaixa(empresaId: string, regime: RegimeDas): Promise<DasItem[]> {
    const tabela = regime === 'mei' ? 'das_mei' : 'declaracoes_pgdas';
    const colunas = regime === 'mei' ? COLUNAS_DAS_MEI : COLUNAS_DECLARACOES_PGDAS;
    const { data, error } = await this.supabase.admin
      .from(tabela)
      .select(colunas)
      .eq('empresa_id', empresaId)
      .eq('status', 'pago')
      .is('lancamento_baixa_id', null)
      .order('competencia', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao listar DAS pendentes de baixa: ${error.message}`);

    return regime === 'mei'
      ? (data as unknown as LinhaDasMei[]).map((linha) => this.mapearMei(linha))
      : (data as unknown as LinhaDeclaracaoPgdas[]).map((linha) => this.mapearSimplesNacional(linha));
  }

  async buscarConfiguracaoLancamentos(empresaId: string): Promise<ConfiguracaoLancamentosDas | null> {
    const { data, error } = await this.supabase.admin
      .from('das_configuracoes_lancamentos')
      .select('empresa_id, conta_debito_id, conta_credito_id')
      .eq('empresa_id', empresaId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar configuração de lançamentos do DAS: ${error.message}`);
    if (!data) return null;

    const linha = data as LinhaConfiguracaoLancamentos;
    return { empresaId: linha.empresa_id, contaDebitoId: linha.conta_debito_id, contaCreditoId: linha.conta_credito_id };
  }

  async salvarConfiguracaoLancamentos(dados: DadosSalvarConfiguracaoLancamentosDas): Promise<void> {
    const { error } = await this.supabase.admin.from('das_configuracoes_lancamentos').upsert({
      empresa_id: dados.empresaId,
      conta_debito_id: dados.contaDebitoId,
      conta_credito_id: dados.contaCreditoId,
      atualizado_por: dados.atualizadoPor,
      atualizado_em: new Date().toISOString(),
    });
    if (error) throw new InternalServerErrorException(`Falha ao salvar configuração de lançamentos do DAS: ${error.message}`);
  }
}
