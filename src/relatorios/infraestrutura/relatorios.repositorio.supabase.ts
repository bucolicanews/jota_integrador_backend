import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { MovimentoConta, RelatoriosRepositorioPort, SaldoContaPeriodo } from '../aplicacao/portas/relatorios-repositorio.port';

interface LinhaSaldo {
  conta_id: string;
  saldo_inicial: number;
  total_debito: number;
  total_credito: number;
  saldo_final: number;
}

interface LinhaMovimento {
  conta_id: string;
  lancamento_id: string;
  data_competencia: string;
  historico: string;
  origem: string;
  tipo: 'debito' | 'credito';
  valor: number;
}

@Injectable()
export class RelatoriosRepositorioSupabase implements RelatoriosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async obterSaldosPeriodo(empresaId: string, dataInicio: string | null, dataFim: string): Promise<SaldoContaPeriodo[]> {
    const { data, error } = await this.supabase.admin.rpc('relatorio_saldos_periodo', {
      p_empresa_id: empresaId,
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
    });
    if (error) throw new InternalServerErrorException(`Falha ao calcular saldos do período: ${error.message}`);
    return (data as LinhaSaldo[]).map((linha) => ({
      contaId: linha.conta_id,
      saldoInicial: Number(linha.saldo_inicial),
      totalDebito: Number(linha.total_debito),
      totalCredito: Number(linha.total_credito),
      saldoFinal: Number(linha.saldo_final),
    }));
  }

  async obterMovimentosPeriodo(empresaId: string, dataInicio: string, dataFim: string, contaId?: string): Promise<MovimentoConta[]> {
    const { data, error } = await this.supabase.admin.rpc('movimentos_periodo_contas', {
      p_empresa_id: empresaId,
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_conta_id: contaId ?? null,
    });
    if (error) throw new InternalServerErrorException(`Falha ao buscar movimentos do período: ${error.message}`);
    return (data as LinhaMovimento[]).map((linha) => ({
      contaId: linha.conta_id,
      lancamentoId: linha.lancamento_id,
      dataCompetencia: linha.data_competencia,
      historico: linha.historico,
      origem: linha.origem,
      tipo: linha.tipo,
      valor: Number(linha.valor),
    }));
  }
}
