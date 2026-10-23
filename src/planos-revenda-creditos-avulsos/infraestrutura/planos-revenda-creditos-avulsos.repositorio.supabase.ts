import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  DadosAtualizacaoPlanoRevendaCreditoAvulso,
  DadosNovoPlanoRevendaCreditoAvulso,
  PlanoRevendaCreditoAvulso,
  PlanosRevendaCreditosAvulsosRepositorioPort,
} from '../aplicacao/portas/planos-revenda-creditos-avulsos-repositorio.port';

interface Linha {
  id: string;
  contador_id: string;
  pacote_id: string;
  nome: string | null;
  valor_venda: number;
  ativo: boolean;
}

const COLUNAS = 'id, contador_id, pacote_id, nome, valor_venda, ativo';

@Injectable()
export class PlanosRevendaCreditosAvulsosRepositorioSupabase implements PlanosRevendaCreditosAvulsosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoPlanoRevendaCreditoAvulso): Promise<PlanoRevendaCreditoAvulso> {
    const { data, error } = await this.supabase.admin
      .from('planos_revenda_creditos_avulsos')
      .insert({
        contador_id: dados.contadorId,
        pacote_id: dados.pacoteId,
        nome: dados.nome,
        valor_venda: dados.valorVenda,
      })
      .select(COLUNAS)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar plano de revenda de crédito avulso: ${error?.message}`);
    }
    return this.mapear(data as Linha);
  }

  async listarPorContador(contadorId: string): Promise<PlanoRevendaCreditoAvulso[]> {
    const { data, error } = await this.supabase.admin
      .from('planos_revenda_creditos_avulsos')
      .select(COLUNAS)
      .eq('contador_id', contadorId)
      .order('criado_em', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar planos de revenda de crédito avulso: ${error.message}`);
    }
    return (data as Linha[]).map((linha) => this.mapear(linha));
  }

  async obterPorId(id: string): Promise<PlanoRevendaCreditoAvulso | null> {
    const { data, error } = await this.supabase.admin
      .from('planos_revenda_creditos_avulsos')
      .select(COLUNAS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar plano de revenda de crédito avulso: ${error.message}`);
    }
    return data ? this.mapear(data as Linha) : null;
  }

  async atualizar(id: string, dados: DadosAtualizacaoPlanoRevendaCreditoAvulso): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.nome !== undefined) campos.nome = dados.nome;
    if (dados.valorVenda !== undefined) campos.valor_venda = dados.valorVenda;
    if (dados.ativo !== undefined) campos.ativo = dados.ativo;

    const { error } = await this.supabase.admin.from('planos_revenda_creditos_avulsos').update(campos).eq('id', id);
    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar plano de revenda de crédito avulso: ${error.message}`);
    }
  }

  async obterPrecoPacote(pacoteId: string): Promise<number | null> {
    const { data, error } = await this.supabase.admin
      .from('pacotes_creditos_avulsos')
      .select('preco_reais')
      .eq('id', pacoteId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar preço do pacote de crédito avulso: ${error.message}`);
    }
    return data ? Number((data as { preco_reais: number }).preco_reais) : null;
  }

  private mapear(linha: Linha): PlanoRevendaCreditoAvulso {
    return {
      id: linha.id,
      contadorId: linha.contador_id,
      pacoteId: linha.pacote_id,
      nome: linha.nome,
      valorVenda: Number(linha.valor_venda),
      ativo: linha.ativo,
    };
  }
}
