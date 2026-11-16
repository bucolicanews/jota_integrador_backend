import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { OrigemReceitaMensal, ReceitaMensal, TipoAtividadeReceita } from '../dominio/receita-mensal';
import { DadosDefinirReceitaMensal, ReceitasMensaisRepositorioPort } from '../aplicacao/portas/receitas-mensais-repositorio.port';

interface Linha {
  id: string;
  empresa_id: string;
  competencia: string;
  tipo_atividade: TipoAtividadeReceita;
  valor: number;
  origem: OrigemReceitaMensal;
  iss_retido_na_fonte: boolean;
  iss_devido_a_outro_municipio: boolean;
}

const COLUNAS = 'id, empresa_id, competencia, tipo_atividade, valor, origem, iss_retido_na_fonte, iss_devido_a_outro_municipio';

@Injectable()
export class ReceitasMensaisRepositorioSupabase implements ReceitasMensaisRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async definir(dados: DadosDefinirReceitaMensal): Promise<ReceitaMensal> {
    // iss_retido_na_fonte/iss_devido_a_outro_municipio só entram no payload quando
    // informados -- senão o upsert reseta pra false (default da coluna) todo vez que o
    // usuário só edita o valor mensal pela tabela de RBT12 (que não manda esses campos).
    const linha: Record<string, unknown> = {
      empresa_id: dados.empresaId,
      competencia: dados.competencia,
      tipo_atividade: dados.tipoAtividade,
      valor: dados.valor,
      origem: 'manual',
      criado_por: dados.criadoPor,
    };
    if (dados.issRetidoNaFonte !== undefined) linha.iss_retido_na_fonte = dados.issRetidoNaFonte;
    if (dados.issDevidoAOutroMunicipio !== undefined) linha.iss_devido_a_outro_municipio = dados.issDevidoAOutroMunicipio;

    const { data, error } = await this.supabase.admin
      .from('receitas_mensais_historico')
      .upsert(linha, { onConflict: 'empresa_id,competencia,tipo_atividade' })
      .select(COLUNAS)
      .single();
    if (error || !data) throw new InternalServerErrorException(`Falha ao gravar receita mensal: ${error?.message}`);
    return this.mapear(data as Linha);
  }

  async listarPorPeriodo(empresaId: string, competenciaInicio: string, competenciaFim: string): Promise<ReceitaMensal[]> {
    const { data, error } = await this.supabase.admin
      .from('receitas_mensais_historico')
      .select(COLUNAS)
      .eq('empresa_id', empresaId)
      .gte('competencia', competenciaInicio)
      .lte('competencia', competenciaFim);
    if (error) throw new InternalServerErrorException(`Falha ao listar receitas mensais: ${error.message}`);
    return (data as Linha[]).map((linha) => this.mapear(linha));
  }

  private mapear(linha: Linha): ReceitaMensal {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      competencia: linha.competencia,
      tipoAtividade: linha.tipo_atividade,
      valor: linha.valor,
      origem: linha.origem,
      issRetidoNaFonte: linha.iss_retido_na_fonte,
      issDevidoAOutroMunicipio: linha.iss_devido_a_outro_municipio,
    };
  }
}
