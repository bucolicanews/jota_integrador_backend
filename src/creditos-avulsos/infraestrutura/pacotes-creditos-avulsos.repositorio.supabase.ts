import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  DadosAtualizacaoPacoteCreditoAvulso,
  DadosNovoPacoteCreditoAvulso,
  PacoteCreditoAvulso,
  PacotesCreditosAvulsosRepositorioPort,
} from '../aplicacao/portas/pacotes-creditos-avulsos-repositorio.port';

interface Linha {
  id: string;
  nome: string;
  quantidade_creditos: number;
  preco_reais: number;
  ativo: boolean;
}

const COLUNAS = 'id, nome, quantidade_creditos, preco_reais, ativo';

@Injectable()
export class PacotesCreditosAvulsosRepositorioSupabase implements PacotesCreditosAvulsosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoPacoteCreditoAvulso): Promise<PacoteCreditoAvulso> {
    const { data, error } = await this.supabase.admin
      .from('pacotes_creditos_avulsos')
      .insert({ nome: dados.nome, quantidade_creditos: dados.quantidadeCreditos, preco_reais: dados.precoReais })
      .select(COLUNAS)
      .single();
    if (error || !data) throw new InternalServerErrorException(`Falha ao criar pacote de crédito avulso: ${error?.message}`);
    return this.mapear(data as Linha);
  }

  async buscarPorId(id: string): Promise<PacoteCreditoAvulso | null> {
    const { data, error } = await this.supabase.admin.from('pacotes_creditos_avulsos').select(COLUNAS).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar pacote de crédito avulso: ${error.message}`);
    return data ? this.mapear(data as Linha) : null;
  }

  async listar(somenteAtivos: boolean): Promise<PacoteCreditoAvulso[]> {
    let query = this.supabase.admin.from('pacotes_creditos_avulsos').select(COLUNAS).order('preco_reais', { ascending: true });
    if (somenteAtivos) {
      query = query.eq('ativo', true);
    }
    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(`Falha ao listar pacotes de crédito avulso: ${error.message}`);
    return (data as Linha[]).map((linha) => this.mapear(linha));
  }

  async atualizar(id: string, dados: DadosAtualizacaoPacoteCreditoAvulso): Promise<PacoteCreditoAvulso> {
    const campos: Record<string, unknown> = {};
    if (dados.nome !== undefined) campos.nome = dados.nome;
    if (dados.quantidadeCreditos !== undefined) campos.quantidade_creditos = dados.quantidadeCreditos;
    if (dados.precoReais !== undefined) campos.preco_reais = dados.precoReais;
    if (dados.ativo !== undefined) campos.ativo = dados.ativo;

    const { data, error } = await this.supabase.admin.from('pacotes_creditos_avulsos').update(campos).eq('id', id).select(COLUNAS).single();
    if (error || !data) throw new InternalServerErrorException(`Falha ao atualizar pacote de crédito avulso: ${error?.message}`);
    return this.mapear(data as Linha);
  }

  private mapear(linha: Linha): PacoteCreditoAvulso {
    return {
      id: linha.id,
      nome: linha.nome,
      quantidadeCreditos: linha.quantidade_creditos,
      precoReais: Number(linha.preco_reais),
      ativo: linha.ativo,
    };
  }
}
