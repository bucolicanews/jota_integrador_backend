import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { StatusTransacaoConciliacao, TipoTransacaoExtrato } from '../dominio/conciliacao';
import { normalizarDescricao } from '../dominio/conciliacao';
import {
  ConciliacaoRepositorioPort,
  ConfiguracaoConciliacao,
  DadosConfiguracao,
  DadosNovaImportacao,
  DadosNovaTransacao,
  FiltroTransacoes,
  ImportacaoConciliacao,
  NovaRegra,
  RegraConciliacao,
  TransacaoConciliacao,
} from '../aplicacao/portas/conciliacao-repositorio.port';

interface LinhaConfiguracao {
  id: string;
  empresa_id: string;
  conta_contabil_id: string;
  nome_configuracao: string;
  mapeamento: ConfiguracaoConciliacao['mapeamento'];
  coluna_tipo_transacao: string | null;
  valor_credito: string | null;
  criado_em: string;
}

interface LinhaRegra {
  id: string;
  empresa_id: string;
  descricao_extrato: string;
  conta_contabil_id: string;
  tipo_lancamento: TipoTransacaoExtrato;
}

interface LinhaImportacao {
  id: string;
  empresa_id: string;
  conta_contabil_id: string;
  usuario_id: string;
  nome_arquivo: string;
  extrato_hash: string;
  criado_em: string;
}

interface LinhaTransacao {
  id: string;
  empresa_id: string;
  conta_contabil_id: string;
  importacao_id: string;
  data_competencia: string;
  descricao: string;
  valor: number;
  tipo: TipoTransacaoExtrato;
  identificacao: string | null;
  chave_dedupe: string;
  status: StatusTransacaoConciliacao;
  conta_contabil_resultado_id: string | null;
  lancamento_id: string | null;
  criado_em: string;
}

const COLUNAS_CONFIGURACAO =
  'id, empresa_id, conta_contabil_id, nome_configuracao, mapeamento, coluna_tipo_transacao, valor_credito, criado_em';
const COLUNAS_IMPORTACAO = 'id, empresa_id, conta_contabil_id, usuario_id, nome_arquivo, extrato_hash, criado_em';
const COLUNAS_TRANSACAO =
  'id, empresa_id, conta_contabil_id, importacao_id, data_competencia, descricao, valor, tipo, identificacao, chave_dedupe, status, conta_contabil_resultado_id, lancamento_id, criado_em';

@Injectable()
export class ConciliacaoRepositorioSupabase implements ConciliacaoRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  // ---------------- Configurações ----------------

  async criarConfiguracao(dados: DadosConfiguracao): Promise<ConfiguracaoConciliacao> {
    const { data, error } = await this.supabase.admin
      .from('conciliacao_configuracoes')
      .insert({
        empresa_id: dados.empresaId,
        conta_contabil_id: dados.contaContabilId,
        nome_configuracao: dados.nomeConfiguracao,
        mapeamento: dados.mapeamento,
        coluna_tipo_transacao: dados.colunaTipoTransacao,
        valor_credito: dados.valorCredito,
      })
      .select(COLUNAS_CONFIGURACAO)
      .single();

    if (error) throw new InternalServerErrorException(`Falha ao criar configuração de conciliação: ${error.message}`);
    return this.mapearConfiguracao(data as LinhaConfiguracao);
  }

  async listarConfiguracoes(empresaId: string, contaContabilId?: string): Promise<ConfiguracaoConciliacao[]> {
    let query = this.supabase.admin
      .from('conciliacao_configuracoes')
      .select(COLUNAS_CONFIGURACAO)
      .eq('empresa_id', empresaId)
      .order('nome_configuracao');
    if (contaContabilId) query = query.eq('conta_contabil_id', contaContabilId);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(`Falha ao listar configurações de conciliação: ${error.message}`);
    return (data as LinhaConfiguracao[]).map((linha) => this.mapearConfiguracao(linha));
  }

  async obterConfiguracao(id: string): Promise<ConfiguracaoConciliacao | null> {
    const { data, error } = await this.supabase.admin
      .from('conciliacao_configuracoes')
      .select(COLUNAS_CONFIGURACAO)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar configuração de conciliação: ${error.message}`);
    return data ? this.mapearConfiguracao(data as LinhaConfiguracao) : null;
  }

  async atualizarConfiguracao(id: string, dados: Partial<DadosConfiguracao>): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.contaContabilId !== undefined) campos.conta_contabil_id = dados.contaContabilId;
    if (dados.nomeConfiguracao !== undefined) campos.nome_configuracao = dados.nomeConfiguracao;
    if (dados.mapeamento !== undefined) campos.mapeamento = dados.mapeamento;
    if (dados.colunaTipoTransacao !== undefined) campos.coluna_tipo_transacao = dados.colunaTipoTransacao;
    if (dados.valorCredito !== undefined) campos.valor_credito = dados.valorCredito;

    const { error } = await this.supabase.admin.from('conciliacao_configuracoes').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar configuração de conciliação: ${error.message}`);
  }

  async excluirConfiguracao(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('conciliacao_configuracoes').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir configuração de conciliação: ${error.message}`);
  }

  // ---------------- Regras ----------------

  async listarRegras(empresaId: string): Promise<RegraConciliacao[]> {
    const { data, error } = await this.supabase.admin
      .from('conciliacao_regras')
      .select('id, empresa_id, descricao_extrato, conta_contabil_id, tipo_lancamento')
      .eq('empresa_id', empresaId);
    if (error) throw new InternalServerErrorException(`Falha ao listar regras de conciliação: ${error.message}`);
    return (data as LinhaRegra[]).map((linha) => ({
      id: linha.id,
      empresaId: linha.empresa_id,
      descricaoExtrato: linha.descricao_extrato,
      contaContabilId: linha.conta_contabil_id,
      tipoLancamento: linha.tipo_lancamento,
    }));
  }

  async upsertRegras(empresaId: string, regras: NovaRegra[]): Promise<void> {
    if (regras.length === 0) return;
    const linhas = regras.map((regra) => ({
      empresa_id: empresaId,
      descricao_extrato: normalizarDescricao(regra.descricaoExtrato),
      conta_contabil_id: regra.contaContabilId,
      tipo_lancamento: regra.tipoLancamento,
    }));
    const { error } = await this.supabase.admin
      .from('conciliacao_regras')
      .upsert(linhas, { onConflict: 'empresa_id, descricao_extrato, tipo_lancamento' });
    if (error) throw new InternalServerErrorException(`Falha ao salvar regras de conciliação: ${error.message}`);
  }

  // ---------------- Importações ----------------

  async obterImportacaoPorHash(empresaId: string, contaContabilId: string, hash: string): Promise<ImportacaoConciliacao | null> {
    const { data, error } = await this.supabase.admin
      .from('conciliacao_importacoes')
      .select(COLUNAS_IMPORTACAO)
      .eq('empresa_id', empresaId)
      .eq('conta_contabil_id', contaContabilId)
      .eq('extrato_hash', hash)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar importação existente: ${error.message}`);
    if (!data) return null;
    return this.mapearImportacaoComContagens(data as LinhaImportacao);
  }

  async criarImportacao(dados: DadosNovaImportacao): Promise<ImportacaoConciliacao> {
    const { data, error } = await this.supabase.admin
      .from('conciliacao_importacoes')
      .insert({
        empresa_id: dados.empresaId,
        conta_contabil_id: dados.contaContabilId,
        usuario_id: dados.usuarioId,
        nome_arquivo: dados.nomeArquivo,
        extrato_hash: dados.hash,
      })
      .select(COLUNAS_IMPORTACAO)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar importação: ${error.message}`);
    return this.mapearImportacaoComContagens(data as LinhaImportacao);
  }

  async listarImportacoes(empresaId: string, contaContabilId?: string): Promise<ImportacaoConciliacao[]> {
    let query = this.supabase.admin
      .from('conciliacao_importacoes')
      .select(COLUNAS_IMPORTACAO)
      .eq('empresa_id', empresaId)
      .order('criado_em', { ascending: false });
    if (contaContabilId) query = query.eq('conta_contabil_id', contaContabilId);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(`Falha ao listar importações: ${error.message}`);

    const linhas = data as LinhaImportacao[];
    return Promise.all(linhas.map((linha) => this.mapearImportacaoComContagens(linha)));
  }

  async obterImportacao(id: string): Promise<ImportacaoConciliacao | null> {
    const { data, error } = await this.supabase.admin.from('conciliacao_importacoes').select(COLUNAS_IMPORTACAO).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar importação: ${error.message}`);
    return data ? this.mapearImportacaoComContagens(data as LinhaImportacao) : null;
  }

  private async mapearImportacaoComContagens(linha: LinhaImportacao): Promise<ImportacaoConciliacao> {
    const { data, error } = await this.supabase.admin.from('conciliacao_transacoes').select('status').eq('importacao_id', linha.id);
    if (error) throw new InternalServerErrorException(`Falha ao contar transações da importação: ${error.message}`);

    const contagens = { pendente: 0, conciliada: 0, duplicada: 0, ignorada: 0 };
    for (const { status } of data as { status: StatusTransacaoConciliacao }[]) contagens[status] += 1;

    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      contaContabilId: linha.conta_contabil_id,
      usuarioId: linha.usuario_id,
      nomeArquivo: linha.nome_arquivo,
      hash: linha.extrato_hash,
      criadoEm: linha.criado_em,
      totalPendentes: contagens.pendente,
      totalConciliadas: contagens.conciliada,
      totalDuplicadas: contagens.duplicada,
      totalIgnoradas: contagens.ignorada,
    };
  }

  // ---------------- Transações ----------------

  async inserirTransacoes(transacoes: DadosNovaTransacao[]): Promise<TransacaoConciliacao[]> {
    if (transacoes.length === 0) return [];
    const linhas = transacoes.map((t) => ({
      empresa_id: t.empresaId,
      conta_contabil_id: t.contaContabilId,
      importacao_id: t.importacaoId,
      data_competencia: t.dataCompetencia,
      descricao: t.descricao,
      valor: t.valor,
      tipo: t.tipo,
      identificacao: t.identificacao,
      chave_dedupe: t.chaveDedupe,
      status: t.status,
      conta_contabil_resultado_id: t.contaContabilResultadoId,
    }));
    const { data, error } = await this.supabase.admin.from('conciliacao_transacoes').insert(linhas).select(COLUNAS_TRANSACAO);
    if (error) throw new InternalServerErrorException(`Falha ao gravar transações extraídas: ${error.message}`);
    return (data as LinhaTransacao[]).map((linha) => this.mapearTransacao(linha));
  }

  async listarTransacoesDaImportacao(importacaoId: string): Promise<TransacaoConciliacao[]> {
    const { data, error } = await this.supabase.admin
      .from('conciliacao_transacoes')
      .select(COLUNAS_TRANSACAO)
      .eq('importacao_id', importacaoId)
      .order('data_competencia');
    if (error) throw new InternalServerErrorException(`Falha ao listar transações da importação: ${error.message}`);
    return (data as LinhaTransacao[]).map((linha) => this.mapearTransacao(linha));
  }

  async listarPorStatus(empresaId: string, filtro: FiltroTransacoes): Promise<TransacaoConciliacao[]> {
    let query = this.supabase.admin
      .from('conciliacao_transacoes')
      .select(COLUNAS_TRANSACAO)
      .eq('empresa_id', empresaId)
      .order('data_competencia', { ascending: false });
    if (filtro.contaContabilId) query = query.eq('conta_contabil_id', filtro.contaContabilId);
    if (filtro.status) query = query.eq('status', filtro.status);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(`Falha ao listar transações: ${error.message}`);
    return (data as LinhaTransacao[]).map((linha) => this.mapearTransacao(linha));
  }

  async obterTransacao(id: string): Promise<TransacaoConciliacao | null> {
    const { data, error } = await this.supabase.admin.from('conciliacao_transacoes').select(COLUNAS_TRANSACAO).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar transação: ${error.message}`);
    return data ? this.mapearTransacao(data as LinhaTransacao) : null;
  }

  async buscarChavesConciliadasExistentes(empresaId: string, contaContabilId: string): Promise<Set<string>> {
    const { data, error } = await this.supabase.admin
      .from('conciliacao_transacoes')
      .select('chave_dedupe')
      .eq('empresa_id', empresaId)
      .eq('conta_contabil_id', contaContabilId)
      .eq('status', 'conciliada');
    if (error) throw new InternalServerErrorException(`Falha ao buscar transações já conciliadas: ${error.message}`);
    return new Set((data as { chave_dedupe: string }[]).map((linha) => linha.chave_dedupe));
  }

  async atualizarContaResultado(id: string, contaContabilResultadoId: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('conciliacao_transacoes')
      .update({ conta_contabil_resultado_id: contaContabilResultadoId })
      .eq('id', id)
      .eq('status', 'pendente');
    if (error) throw new InternalServerErrorException(`Falha ao atualizar conta contábil da transação: ${error.message}`);
  }

  async marcarConciliada(id: string, lancamentoId: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('conciliacao_transacoes')
      .update({ status: 'conciliada', lancamento_id: lancamentoId })
      .eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao marcar transação como conciliada: ${error.message}`);
  }

  async marcarIgnorada(id: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('conciliacao_transacoes')
      .update({ status: 'ignorada' })
      .eq('id', id)
      .eq('status', 'pendente');
    if (error) throw new InternalServerErrorException(`Falha ao ignorar transação: ${error.message}`);
  }

  // ---------------- Mapeadores ----------------

  private mapearConfiguracao(linha: LinhaConfiguracao): ConfiguracaoConciliacao {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      contaContabilId: linha.conta_contabil_id,
      nomeConfiguracao: linha.nome_configuracao,
      mapeamento: linha.mapeamento,
      colunaTipoTransacao: linha.coluna_tipo_transacao,
      valorCredito: linha.valor_credito,
      criadoEm: linha.criado_em,
    };
  }

  private mapearTransacao(linha: LinhaTransacao): TransacaoConciliacao {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      contaContabilId: linha.conta_contabil_id,
      importacaoId: linha.importacao_id,
      dataCompetencia: linha.data_competencia,
      descricao: linha.descricao,
      valor: Number(linha.valor),
      tipo: linha.tipo,
      identificacao: linha.identificacao,
      chaveDedupe: linha.chave_dedupe,
      status: linha.status,
      contaContabilResultadoId: linha.conta_contabil_resultado_id,
      lancamentoId: linha.lancamento_id,
      criadoEm: linha.criado_em,
    };
  }
}
