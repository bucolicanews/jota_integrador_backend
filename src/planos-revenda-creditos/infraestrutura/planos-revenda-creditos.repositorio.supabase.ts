import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  DadosAtualizacaoPlanoRevendaCredito,
  DadosNovoPlanoRevendaCredito,
  PlanoRevendaCredito,
  PlanosRevendaCreditosRepositorioPort,
} from '../aplicacao/portas/planos-revenda-creditos-repositorio.port';

interface Linha {
  id: string;
  contador_id: string;
  plano_id: string;
  nome: string | null;
  valor_venda: number;
  ativo: boolean;
}

const COLUNAS = 'id, contador_id, plano_id, nome, valor_venda, ativo';

@Injectable()
export class PlanosRevendaCreditosRepositorioSupabase implements PlanosRevendaCreditosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoPlanoRevendaCredito): Promise<PlanoRevendaCredito> {
    const { data, error } = await this.supabase.admin
      .from('planos_revenda_creditos')
      .insert({
        contador_id: dados.contadorId,
        plano_id: dados.planoId,
        nome: dados.nome,
        valor_venda: dados.valorVenda,
      })
      .select(COLUNAS)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar plano de revenda: ${error?.message}`);
    }
    return this.mapear(data as Linha);
  }

  async listarPorContador(contadorId: string): Promise<PlanoRevendaCredito[]> {
    const { data, error } = await this.supabase.admin
      .from('planos_revenda_creditos')
      .select(COLUNAS)
      .eq('contador_id', contadorId)
      .order('criado_em', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar planos de revenda: ${error.message}`);
    }
    return (data as Linha[]).map((linha) => this.mapear(linha));
  }

  async obterPorId(id: string): Promise<PlanoRevendaCredito | null> {
    const { data, error } = await this.supabase.admin
      .from('planos_revenda_creditos')
      .select(COLUNAS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar plano de revenda: ${error.message}`);
    }
    return data ? this.mapear(data as Linha) : null;
  }

  async obterAtivoPorContadorEPlano(contadorId: string, planoId: string): Promise<PlanoRevendaCredito | null> {
    const { data, error } = await this.supabase.admin
      .from('planos_revenda_creditos')
      .select(COLUNAS)
      .eq('contador_id', contadorId)
      .eq('plano_id', planoId)
      .eq('ativo', true)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar plano de revenda ativo: ${error.message}`);
    }
    return data ? this.mapear(data as Linha) : null;
  }

  async atualizar(id: string, dados: DadosAtualizacaoPlanoRevendaCredito): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.nome !== undefined) campos.nome = dados.nome;
    if (dados.valorVenda !== undefined) campos.valor_venda = dados.valorVenda;
    if (dados.ativo !== undefined) campos.ativo = dados.ativo;

    const { error } = await this.supabase.admin.from('planos_revenda_creditos').update(campos).eq('id', id);
    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar plano de revenda: ${error.message}`);
    }
  }

  private mapear(linha: Linha): PlanoRevendaCredito {
    return {
      id: linha.id,
      contadorId: linha.contador_id,
      planoId: linha.plano_id,
      nome: linha.nome,
      valorVenda: Number(linha.valor_venda),
      ativo: linha.ativo,
    };
  }
}
