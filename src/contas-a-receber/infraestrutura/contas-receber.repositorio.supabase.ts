import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { calcularStatus, gerarParcelas } from '../dominio/conta-receber';
import {
  ContaReceber,
  ContasReceberRepositorioPort,
  DadosNovaContaReceber,
  DadosNovoRecebimento,
  FiltroContasReceber,
  ParcelaContaReceber,
  RecebimentoContaReceber,
} from '../aplicacao/portas/contas-receber-repositorio.port';

interface LinhaConta {
  id: string;
  empresa_id: string;
  cliente_id: string | null;
  cliente_nome: string;
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
  conta_receber_id: string;
  empresa_id: string;
  numero_parcela: number;
  valor_parcela: number;
  data_vencimento: string;
  cancelada: boolean;
}

interface LinhaRecebimento {
  id: string;
  parcela_id: string;
  empresa_id: string;
  conta_bancaria_id: string;
  valor_recebido: number;
  data_recebimento: string;
  lancamento_id: string;
  estornado: boolean;
  criado_por: string;
  criado_em: string;
}

const COLUNAS_CONTA = 'id, empresa_id, cliente_id, cliente_nome, descricao, valor_total, data_emissao, conta_patrimonial_id, conta_resultado_id, cancelada, criado_por, criado_em';
const COLUNAS_PARCELA = 'id, conta_receber_id, empresa_id, numero_parcela, valor_parcela, data_vencimento, cancelada';
const COLUNAS_RECEBIMENTO = 'id, parcela_id, empresa_id, conta_bancaria_id, valor_recebido, data_recebimento, lancamento_id, estornado, criado_por, criado_em';

@Injectable()
export class ContasReceberRepositorioSupabase implements ContasReceberRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criarComParcelas(dados: DadosNovaContaReceber): Promise<string> {
    const parcelas = gerarParcelas(dados.modo, dados.valor, dados.quantidadeParcelas, dados.primeiroVencimento, dados.intervaloDias);

    const { data, error } = await this.supabase.admin.rpc('criar_conta_receber_com_parcelas', {
      p_empresa_id: dados.empresaId,
      p_cliente_nome: dados.clienteNome,
      p_descricao: dados.descricao,
      p_conta_patrimonial_id: dados.contaPatrimonialId,
      p_conta_resultado_id: dados.contaResultadoId,
      p_data_emissao: dados.dataEmissao,
      p_criado_por: dados.criadoPor,
      p_parcelas: parcelas.map((p) => ({ numero_parcela: p.numeroParcela, valor_parcela: p.valorParcela, data_vencimento: p.dataVencimento })),
    });

    if (error) throw new BadRequestException(error.message);
    const contaId = data as string;

    // cliente_id não faz parte da função atômica (assinatura fixa, evita o risco de
    // sobrecarga ambígua documentado no projeto ao mudar assinatura de função SQL já em
    // uso) -- é um link opcional de baixo risco, setado logo em seguida. Se essa
    // segunda chamada falhar, a conta já existe corretamente, só sem o link (recuperável
    // via atualizar depois -- não é um problema de integridade financeira como seria
    // falhar a criação do lançamento).
    if (dados.clienteId) {
      const { error: erroVinculo } = await this.supabase.admin.from('contas_receber').update({ cliente_id: dados.clienteId }).eq('id', contaId);
      if (erroVinculo) throw new InternalServerErrorException(`Conta criada, mas falha ao vincular cliente: ${erroVinculo.message}`);
    }

    return contaId;
  }

  async listarPorEmpresa(empresaId: string, filtro?: FiltroContasReceber): Promise<ContaReceber[]> {
    const { data, error } = await this.supabase.admin.from('contas_receber').select(COLUNAS_CONTA).eq('empresa_id', empresaId).order('data_emissao', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao listar contas a receber: ${error.message}`);

    const contas = await this.montarContasComParcelas(data as LinhaConta[]);
    return filtro?.status ? contas.filter((c) => c.status === filtro.status) : contas;
  }

  async obterPorId(id: string): Promise<ContaReceber | null> {
    const { data, error } = await this.supabase.admin.from('contas_receber').select(COLUNAS_CONTA).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar conta a receber: ${error.message}`);
    if (!data) return null;
    const [conta] = await this.montarContasComParcelas([data as LinhaConta]);
    return conta;
  }

  async cancelar(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('contas_receber').update({ cancelada: true }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao cancelar conta a receber: ${error.message}`);
  }

  async obterParcela(id: string): Promise<ParcelaContaReceber | null> {
    const { data, error } = await this.supabase.admin.from('parcelas_contas_receber').select(COLUNAS_PARCELA).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar parcela: ${error.message}`);
    if (!data) return null;

    const recebimentos = await this.buscarRecebimentosDeVarias([id]);
    return this.mapearParcela(data as LinhaParcela, recebimentos.get(id) ?? []);
  }

  async criarRecebimento(dados: DadosNovoRecebimento): Promise<RecebimentoContaReceber> {
    const { data, error } = await this.supabase.admin
      .from('recebimentos_contas_receber')
      .insert({
        parcela_id: dados.parcelaId,
        empresa_id: dados.empresaId,
        conta_bancaria_id: dados.contaBancariaId,
        valor_recebido: dados.valorRecebido,
        data_recebimento: dados.dataRecebimento,
        lancamento_id: dados.lancamentoId,
        criado_por: dados.criadoPor,
      })
      .select(COLUNAS_RECEBIMENTO)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao registrar recebimento: ${error.message}`);
    return this.mapearRecebimento(data as LinhaRecebimento);
  }

  async listarRecebimentosDaParcela(parcelaId: string): Promise<RecebimentoContaReceber[]> {
    const { data, error } = await this.supabase.admin
      .from('recebimentos_contas_receber')
      .select(COLUNAS_RECEBIMENTO)
      .eq('parcela_id', parcelaId)
      .order('criado_em', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao listar recebimentos da parcela: ${error.message}`);
    return (data as LinhaRecebimento[]).map((linha) => this.mapearRecebimento(linha));
  }

  async obterRecebimento(id: string): Promise<RecebimentoContaReceber | null> {
    const { data, error } = await this.supabase.admin.from('recebimentos_contas_receber').select(COLUNAS_RECEBIMENTO).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar recebimento: ${error.message}`);
    return data ? this.mapearRecebimento(data as LinhaRecebimento) : null;
  }

  async marcarRecebimentoEstornado(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('recebimentos_contas_receber').update({ estornado: true }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao estornar recebimento: ${error.message}`);
  }

  // ---------------- Helpers ----------------

  private async montarContasComParcelas(linhasConta: LinhaConta[]): Promise<ContaReceber[]> {
    if (linhasConta.length === 0) return [];
    const contaIds = linhasConta.map((c) => c.id);

    const { data: linhasParcela, error: erroParcelas } = await this.supabase.admin
      .from('parcelas_contas_receber')
      .select(COLUNAS_PARCELA)
      .in('conta_receber_id', contaIds)
      .order('numero_parcela');
    if (erroParcelas) throw new InternalServerErrorException(`Falha ao buscar parcelas: ${erroParcelas.message}`);

    const parcelas = linhasParcela as LinhaParcela[];
    const recebimentosPorParcela = await this.buscarRecebimentosDeVarias(parcelas.map((p) => p.id));

    const parcelasPorConta = new Map<string, ParcelaContaReceber[]>();
    for (const linhaParcela of parcelas) {
      const parcela = this.mapearParcela(linhaParcela, recebimentosPorParcela.get(linhaParcela.id) ?? []);
      const lista = parcelasPorConta.get(linhaParcela.conta_receber_id) ?? [];
      lista.push(parcela);
      parcelasPorConta.set(linhaParcela.conta_receber_id, lista);
    }

    return linhasConta.map((linha) => {
      const parcelasDaConta = parcelasPorConta.get(linha.id) ?? [];
      const valorRecebido = parcelasDaConta.reduce((soma, p) => soma + p.valorRecebido, 0);
      return {
        id: linha.id,
        empresaId: linha.empresa_id,
        clienteId: linha.cliente_id,
        clienteNome: linha.cliente_nome,
        descricao: linha.descricao,
        valorTotal: Number(linha.valor_total),
        dataEmissao: linha.data_emissao,
        contaPatrimonialId: linha.conta_patrimonial_id,
        contaResultadoId: linha.conta_resultado_id,
        cancelada: linha.cancelada,
        criadoPor: linha.criado_por,
        criadoEm: linha.criado_em,
        valorRecebido,
        status: calcularStatus(Number(linha.valor_total), valorRecebido, linha.cancelada),
        parcelas: parcelasDaConta,
      };
    });
  }

  private async buscarRecebimentosDeVarias(parcelaIds: string[]): Promise<Map<string, LinhaRecebimento[]>> {
    const mapa = new Map<string, LinhaRecebimento[]>();
    if (parcelaIds.length === 0) return mapa;

    const { data, error } = await this.supabase.admin
      .from('recebimentos_contas_receber')
      .select(COLUNAS_RECEBIMENTO)
      .in('parcela_id', parcelaIds)
      .eq('estornado', false);
    if (error) throw new InternalServerErrorException(`Falha ao buscar recebimentos: ${error.message}`);

    for (const linha of data as LinhaRecebimento[]) {
      const lista = mapa.get(linha.parcela_id) ?? [];
      lista.push(linha);
      mapa.set(linha.parcela_id, lista);
    }
    return mapa;
  }

  private mapearParcela(linha: LinhaParcela, recebimentos: LinhaRecebimento[]): ParcelaContaReceber {
    const valorRecebido = recebimentos.reduce((soma, r) => soma + Number(r.valor_recebido), 0);
    return {
      id: linha.id,
      contaReceberId: linha.conta_receber_id,
      empresaId: linha.empresa_id,
      numeroParcela: linha.numero_parcela,
      valorParcela: Number(linha.valor_parcela),
      dataVencimento: linha.data_vencimento,
      cancelada: linha.cancelada,
      valorRecebido,
      status: calcularStatus(Number(linha.valor_parcela), valorRecebido, linha.cancelada),
    };
  }

  private mapearRecebimento(linha: LinhaRecebimento): RecebimentoContaReceber {
    return {
      id: linha.id,
      parcelaId: linha.parcela_id,
      empresaId: linha.empresa_id,
      contaBancariaId: linha.conta_bancaria_id,
      valorRecebido: Number(linha.valor_recebido),
      dataRecebimento: linha.data_recebimento,
      lancamentoId: linha.lancamento_id,
      estornado: linha.estornado,
      criadoPor: linha.criado_por,
      criadoEm: linha.criado_em,
    };
  }
}
