import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  ConfiguracaoLancamentosEsocial,
  DadosSalvarConfiguracaoLancamentosEsocial,
  EsocialRepositorioPort,
} from '../aplicacao/portas/esocial-repositorio.port';

interface LinhaConfig {
  empresa_id: string;
  conta_despesa_salario_id: string;
  conta_despesa_pro_labore_id: string;
  conta_despesa_inss_id: string;
  conta_passivo_inss_id: string;
  conta_passivo_salario_a_pagar_id: string;
  conta_passivo_pro_labore_a_pagar_id: string;
  conta_despesa_fgts_id: string | null;
  conta_passivo_fgts_id: string | null;
}

const COLUNAS =
  'empresa_id, conta_despesa_salario_id, conta_despesa_pro_labore_id, conta_despesa_inss_id, conta_passivo_inss_id, conta_passivo_salario_a_pagar_id, conta_passivo_pro_labore_a_pagar_id, conta_despesa_fgts_id, conta_passivo_fgts_id';

@Injectable()
export class EsocialRepositorioSupabase implements EsocialRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async buscarConfiguracaoLancamentos(empresaId: string): Promise<ConfiguracaoLancamentosEsocial | null> {
    const { data, error } = await this.supabase.admin
      .from('configuracoes_lancamentos_esocial')
      .select(COLUNAS)
      .eq('empresa_id', empresaId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar configuração de lançamentos eSocial: ${error.message}`);
    if (!data) return null;
    const linha = data as LinhaConfig;
    return {
      empresaId: linha.empresa_id,
      contaDespesaSalarioId: linha.conta_despesa_salario_id,
      contaDespesaProLaboreId: linha.conta_despesa_pro_labore_id,
      contaDespesaInssId: linha.conta_despesa_inss_id,
      contaPassivoInssId: linha.conta_passivo_inss_id,
      contaPassivoSalarioAPagarId: linha.conta_passivo_salario_a_pagar_id,
      contaPassivoProLaboreAPagarId: linha.conta_passivo_pro_labore_a_pagar_id,
      contaDespesaFgtsId: linha.conta_despesa_fgts_id,
      contaPassivoFgtsId: linha.conta_passivo_fgts_id,
    };
  }

  async salvarConfiguracaoLancamentos(dados: DadosSalvarConfiguracaoLancamentosEsocial): Promise<void> {
    const { error } = await this.supabase.admin.from('configuracoes_lancamentos_esocial').upsert({
      empresa_id: dados.empresaId,
      conta_despesa_salario_id: dados.contaDespesaSalarioId,
      conta_despesa_pro_labore_id: dados.contaDespesaProLaboreId,
      conta_despesa_inss_id: dados.contaDespesaInssId,
      conta_passivo_inss_id: dados.contaPassivoInssId,
      conta_passivo_salario_a_pagar_id: dados.contaPassivoSalarioAPagarId,
      conta_passivo_pro_labore_a_pagar_id: dados.contaPassivoProLaboreAPagarId,
      conta_despesa_fgts_id: dados.contaDespesaFgtsId,
      conta_passivo_fgts_id: dados.contaPassivoFgtsId,
      atualizado_por: dados.atualizadoPor,
      atualizado_em: new Date().toISOString(),
    });
    if (error) throw new InternalServerErrorException(`Falha ao salvar configuração de lançamentos eSocial: ${error.message}`);
  }
}
