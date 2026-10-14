import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  FiltroRelatorioConsultas,
  LinhaRelatorioConsultas,
  RelatorioConsultasSerproRepositorioPort,
} from '../aplicacao/portas/relatorio-consultas-serpro-repositorio.port';

interface LinhaRpc {
  id_sistema: string;
  contador_id: string;
  empresa_id: string;
  total_consultas: number;
  total_sucesso: number;
  custo_total_reais: number;
}

@Injectable()
export class RelatorioConsultasSerproRepositorioSupabase implements RelatorioConsultasSerproRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async agregarPorFiltro(filtro: FiltroRelatorioConsultas): Promise<LinhaRelatorioConsultas[]> {
    const { data, error } = await this.supabase.admin.rpc('relatorio_consultas_serpro', {
      p_contador_id: filtro.contadorId ?? null,
      p_empresa_id: filtro.empresaId ?? null,
      p_id_sistema: filtro.idSistema ?? null,
      p_data_inicio: filtro.dataInicio ?? null,
      p_data_fim: filtro.dataFim ?? null,
    });
    if (error) throw new InternalServerErrorException(`Falha ao gerar relatório de consultas SERPRO: ${error.message}`);
    return (data as LinhaRpc[]).map((linha) => ({
      idSistema: linha.id_sistema,
      contadorId: linha.contador_id,
      empresaId: linha.empresa_id,
      totalConsultas: Number(linha.total_consultas),
      totalSucesso: Number(linha.total_sucesso),
      custoTotalReais: Number(linha.custo_total_reais),
    }));
  }
}
