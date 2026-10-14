import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  CustoConsultaSerpro,
  CustosConsultasSerproRepositorioPort,
} from '../aplicacao/portas/custos-consultas-serpro-repositorio.port';

interface Linha {
  id_sistema: string;
  custo_reais: number;
  atualizado_em: string;
}

const COLUNAS = 'id_sistema, custo_reais, atualizado_em';

@Injectable()
export class CustosConsultasSerproRepositorioSupabase implements CustosConsultasSerproRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(): Promise<CustoConsultaSerpro[]> {
    const { data, error } = await this.supabase.admin
      .from('custos_consultas_serpro')
      .select(COLUNAS)
      .order('id_sistema');
    if (error) throw new InternalServerErrorException(`Falha ao listar custos de consulta: ${error.message}`);
    return (data as Linha[]).map((linha) => this.mapear(linha));
  }

  async definir(idSistema: string, custoReais: number): Promise<CustoConsultaSerpro> {
    const { data, error } = await this.supabase.admin
      .from('custos_consultas_serpro')
      .upsert({ id_sistema: idSistema, custo_reais: custoReais })
      .select(COLUNAS)
      .single();
    if (error || !data) throw new InternalServerErrorException(`Falha ao definir custo de consulta: ${error?.message}`);
    return this.mapear(data as Linha);
  }

  async remover(idSistema: string): Promise<void> {
    const { error } = await this.supabase.admin.from('custos_consultas_serpro').delete().eq('id_sistema', idSistema);
    if (error) throw new InternalServerErrorException(`Falha ao remover custo de consulta: ${error.message}`);
  }

  private mapear(linha: Linha): CustoConsultaSerpro {
    return { idSistema: linha.id_sistema, custoReais: Number(linha.custo_reais), atualizadoEm: linha.atualizado_em };
  }
}
