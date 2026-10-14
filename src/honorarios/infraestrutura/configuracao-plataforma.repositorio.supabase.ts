import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  ConfiguracaoPagbank,
  ConfiguracaoPlataformaRepositorioPort,
  DadosAtualizacaoConfiguracaoPagbank,
} from '../aplicacao/portas/configuracao-plataforma-repositorio.port';

@Injectable()
export class ConfiguracaoPlataformaRepositorioSupabase implements ConfiguracaoPlataformaRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async obterComissaoHonorariosPct(): Promise<number> {
    const { data, error } = await this.supabase.admin
      .from('configuracoes_plataforma')
      .select('comissao_honorarios_pct')
      .eq('id', 1)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao obter comissão da plataforma: ${error?.message}`);
    }
    return Number(data.comissao_honorarios_pct);
  }

  async atualizarComissaoHonorariosPct(pct: number): Promise<void> {
    const { error } = await this.supabase.admin
      .from('configuracoes_plataforma')
      .update({ comissao_honorarios_pct: pct })
      .eq('id', 1);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar comissão da plataforma: ${error.message}`);
    }
  }

  async obterConfiguracaoPagbank(): Promise<ConfiguracaoPagbank> {
    const { data, error } = await this.supabase.admin
      .from('configuracoes_plataforma')
      .select('pagbank_account_id, pagbank_sandbox, pagbank_split_habilitado')
      .eq('id', 1)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao obter configuração PagBank: ${error?.message}`);
    }
    return {
      accountId: data.pagbank_account_id,
      sandbox: data.pagbank_sandbox,
      splitHabilitado: data.pagbank_split_habilitado,
    };
  }

  async atualizarConfiguracaoPagbank(dados: DadosAtualizacaoConfiguracaoPagbank): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.accountId !== undefined) campos.pagbank_account_id = dados.accountId;
    if (dados.sandbox !== undefined) campos.pagbank_sandbox = dados.sandbox;
    if (dados.splitHabilitado !== undefined) campos.pagbank_split_habilitado = dados.splitHabilitado;

    const { error } = await this.supabase.admin.from('configuracoes_plataforma').update(campos).eq('id', 1);
    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar configuração PagBank: ${error.message}`);
    }
  }
}
