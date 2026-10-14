import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  DadosAtualizacaoPlanoRevenda,
  DadosNovoPlanoRevenda,
  PlanoRevendaPacote,
  PlanosRevendaPacoteRepositorioPort,
} from '../aplicacao/portas/planos-revenda-pacote-repositorio.port';

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
export class PlanosRevendaPacoteRepositorioSupabase implements PlanosRevendaPacoteRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoPlanoRevenda): Promise<PlanoRevendaPacote> {
    const { data, error } = await this.supabase.admin
      .from('planos_revenda_pacote')
      .insert({
        contador_id: dados.contadorId,
        pacote_id: dados.pacoteId,
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

  async listarPorContador(contadorId: string): Promise<PlanoRevendaPacote[]> {
    const { data, error } = await this.supabase.admin
      .from('planos_revenda_pacote')
      .select(COLUNAS)
      .eq('contador_id', contadorId)
      .order('criado_em', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar planos de revenda: ${error.message}`);
    }
    return (data as Linha[]).map((linha) => this.mapear(linha));
  }

  async obterPorId(id: string): Promise<PlanoRevendaPacote | null> {
    const { data, error } = await this.supabase.admin
      .from('planos_revenda_pacote')
      .select(COLUNAS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar plano de revenda: ${error.message}`);
    }
    return data ? this.mapear(data as Linha) : null;
  }

  async obterAtivoPorContadorEPacote(contadorId: string, pacoteId: string): Promise<PlanoRevendaPacote | null> {
    const { data, error } = await this.supabase.admin
      .from('planos_revenda_pacote')
      .select(COLUNAS)
      .eq('contador_id', contadorId)
      .eq('pacote_id', pacoteId)
      .eq('ativo', true)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar plano de revenda ativo: ${error.message}`);
    }
    return data ? this.mapear(data as Linha) : null;
  }

  async atualizar(id: string, dados: DadosAtualizacaoPlanoRevenda): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.nome !== undefined) campos.nome = dados.nome;
    if (dados.valorVenda !== undefined) campos.valor_venda = dados.valorVenda;
    if (dados.ativo !== undefined) campos.ativo = dados.ativo;

    const { error } = await this.supabase.admin.from('planos_revenda_pacote').update(campos).eq('id', id);
    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar plano de revenda: ${error.message}`);
    }
  }

  private mapear(linha: Linha): PlanoRevendaPacote {
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
