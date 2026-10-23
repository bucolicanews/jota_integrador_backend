import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  ConfiguracaoCreditosAvulsos,
  ConfiguracaoCreditosAvulsosRepositorioPort,
} from '../aplicacao/portas/configuracao-creditos-avulsos-repositorio.port';

@Injectable()
export class ConfiguracaoCreditosAvulsosRepositorioSupabase implements ConfiguracaoCreditosAvulsosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async obter(): Promise<ConfiguracaoCreditosAvulsos> {
    const { data, error } = await this.supabase.admin
      .from('configuracao_creditos_avulsos')
      .select('valor_por_credito')
      .eq('id', true)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao buscar configuração de crédito avulso: ${error?.message}`);
    }
    return { valorPorCredito: Number((data as { valor_por_credito: number }).valor_por_credito) };
  }

  async definirValorPorCredito(valorPorCredito: number): Promise<void> {
    const { error } = await this.supabase.admin
      .from('configuracao_creditos_avulsos')
      .update({ valor_por_credito: valorPorCredito })
      .eq('id', true);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar valor por crédito: ${error.message}`);
    }
  }
}
