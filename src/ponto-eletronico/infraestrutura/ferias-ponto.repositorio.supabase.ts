import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  DadosNovasFerias,
  FeriasPonto,
  FeriasPontoRepositorioPort,
  StatusFerias,
} from '../aplicacao/portas/ferias-ponto-repositorio.port';

interface LinhaFerias {
  id: string;
  usuario_id: string;
  contador_id: string | null;
  empresa_id: string | null;
  data_inicio: string;
  data_fim: string;
  periodo_referencia: string | null;
  status: StatusFerias;
  criado_por: string;
  criado_em: string;
}

const COLUNAS = 'id, usuario_id, contador_id, empresa_id, data_inicio, data_fim, periodo_referencia, status, criado_por, criado_em';

@Injectable()
export class FeriasPontoRepositorioSupabase implements FeriasPontoRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovasFerias): Promise<FeriasPonto> {
    const { data, error } = await this.supabase.admin
      .from('ponto_ferias')
      .insert({
        usuario_id: dados.usuarioId,
        contador_id: dados.contadorId,
        empresa_id: dados.empresaId,
        data_inicio: dados.dataInicio,
        data_fim: dados.dataFim,
        periodo_referencia: dados.periodoReferencia,
        criado_por: dados.criadoPor,
      })
      .select(COLUNAS)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar férias: ${error.message}`);
    return this.mapear(data as LinhaFerias);
  }

  async listarPorUsuario(usuarioId: string): Promise<FeriasPonto[]> {
    const { data, error } = await this.supabase.admin
      .from('ponto_ferias')
      .select(COLUNAS)
      .eq('usuario_id', usuarioId)
      .order('data_inicio', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao listar férias: ${error.message}`);
    return (data as LinhaFerias[]).map((linha) => this.mapear(linha));
  }

  async listarPorUsuarioNoIntervalo(usuarioId: string, inicio: string, fim: string): Promise<FeriasPonto[]> {
    // Período toca o intervalo se começa antes do fim E termina depois (ou igual) do início -- overlap clássico.
    const { data, error } = await this.supabase.admin
      .from('ponto_ferias')
      .select(COLUNAS)
      .eq('usuario_id', usuarioId)
      .neq('status', 'cancelada')
      .lte('data_inicio', fim.slice(0, 10))
      .gte('data_fim', inicio.slice(0, 10));
    if (error) throw new InternalServerErrorException(`Falha ao listar férias do período: ${error.message}`);
    return (data as LinhaFerias[]).map((linha) => this.mapear(linha));
  }

  async obterPorId(id: string): Promise<FeriasPonto | null> {
    const { data, error } = await this.supabase.admin.from('ponto_ferias').select(COLUNAS).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar férias: ${error.message}`);
    return data ? this.mapear(data as LinhaFerias) : null;
  }

  async atualizarStatus(id: string, status: StatusFerias): Promise<void> {
    const { error } = await this.supabase.admin.from('ponto_ferias').update({ status }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar status das férias: ${error.message}`);
  }

  private mapear(linha: LinhaFerias): FeriasPonto {
    return {
      id: linha.id,
      usuarioId: linha.usuario_id,
      contadorId: linha.contador_id,
      empresaId: linha.empresa_id,
      dataInicio: linha.data_inicio,
      dataFim: linha.data_fim,
      periodoReferencia: linha.periodo_referencia,
      status: linha.status,
      criadoPor: linha.criado_por,
      criadoEm: linha.criado_em,
    };
  }
}
