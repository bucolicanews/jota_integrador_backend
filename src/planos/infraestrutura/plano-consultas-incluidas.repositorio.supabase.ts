import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  ConsultaIncluidaPlano,
  PeriodoConsultaIncluida,
  PlanoConsultasIncluidasRepositorioPort,
} from '../aplicacao/portas/plano-consultas-incluidas-repositorio.port';

interface Linha {
  id: string;
  plano_id: string;
  id_sistema: string;
  quantidade_por_periodo: number;
  periodo: PeriodoConsultaIncluida;
}

const COLUNAS = 'id, plano_id, id_sistema, quantidade_por_periodo, periodo';

@Injectable()
export class PlanoConsultasIncluidasRepositorioSupabase implements PlanoConsultasIncluidasRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async listarPorPlano(planoId: string): Promise<ConsultaIncluidaPlano[]> {
    const { data, error } = await this.supabase.admin
      .from('plano_consultas_incluidas')
      .select(COLUNAS)
      .eq('plano_id', planoId)
      .order('id_sistema');
    if (error) throw new InternalServerErrorException(`Falha ao listar consultas incluídas: ${error.message}`);
    return (data as Linha[]).map((linha) => this.mapear(linha));
  }

  async buscar(planoId: string, idSistema: string): Promise<ConsultaIncluidaPlano | null> {
    const { data, error } = await this.supabase.admin
      .from('plano_consultas_incluidas')
      .select(COLUNAS)
      .eq('plano_id', planoId)
      .eq('id_sistema', idSistema)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar consulta incluída: ${error.message}`);
    return data ? this.mapear(data as Linha) : null;
  }

  async definir(
    planoId: string,
    idSistema: string,
    quantidadePorPeriodo: number,
    periodo: PeriodoConsultaIncluida,
  ): Promise<ConsultaIncluidaPlano> {
    const { data, error } = await this.supabase.admin
      .from('plano_consultas_incluidas')
      .upsert(
        { plano_id: planoId, id_sistema: idSistema, quantidade_por_periodo: quantidadePorPeriodo, periodo },
        { onConflict: 'plano_id,id_sistema' },
      )
      .select(COLUNAS)
      .single();
    if (error || !data) throw new InternalServerErrorException(`Falha ao definir consulta incluída: ${error?.message}`);
    return this.mapear(data as Linha);
  }

  async remover(planoId: string, idSistema: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('plano_consultas_incluidas')
      .delete()
      .eq('plano_id', planoId)
      .eq('id_sistema', idSistema);
    if (error) throw new InternalServerErrorException(`Falha ao remover consulta incluída: ${error.message}`);
  }

  private mapear(linha: Linha): ConsultaIncluidaPlano {
    return {
      id: linha.id,
      planoId: linha.plano_id,
      idSistema: linha.id_sistema,
      quantidadePorPeriodo: linha.quantidade_por_periodo,
      periodo: linha.periodo,
    };
  }
}
