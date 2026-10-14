import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { Periodicidade } from '../aplicacao/portas/pacotes-modulos-repositorio.port';
import { DadosPacoteModulos, PacoteModulos, PacotesModulosRepositorioPort } from '../aplicacao/portas/pacotes-modulos-repositorio.port';

interface Linha {
  id: string;
  nome: string;
  descricao: string | null;
  modulos: string[];
  preco: number;
  periodicidade: Periodicidade;
  data_validade: string | null;
  gratuito: boolean;
  ativo: boolean;
}

const COLUNAS = 'id, nome, descricao, modulos, preco, periodicidade, data_validade, gratuito, ativo';

@Injectable()
export class PacotesModulosRepositorioSupabase implements PacotesModulosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosPacoteModulos): Promise<PacoteModulos> {
    const { data, error } = await this.supabase.admin
      .from('pacotes_modulos')
      .insert({
        nome: dados.nome,
        descricao: dados.descricao,
        modulos: dados.modulos,
        preco: dados.preco,
        periodicidade: dados.periodicidade,
        data_validade: dados.dataValidade,
        gratuito: dados.gratuito,
      })
      .select(COLUNAS)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar pacote: ${error.message}`);
    return this.mapear(data as Linha);
  }

  async listar(apenasAtivos?: boolean): Promise<PacoteModulos[]> {
    let query = this.supabase.admin.from('pacotes_modulos').select(COLUNAS).order('nome');
    if (apenasAtivos) query = query.eq('ativo', true);
    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(`Falha ao listar pacotes: ${error.message}`);
    return (data as Linha[]).map((linha) => this.mapear(linha));
  }

  async obterPorId(id: string): Promise<PacoteModulos | null> {
    const { data, error } = await this.supabase.admin.from('pacotes_modulos').select(COLUNAS).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar pacote: ${error.message}`);
    return data ? this.mapear(data as Linha) : null;
  }

  async atualizar(id: string, dados: Partial<DadosPacoteModulos>): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.nome !== undefined) campos.nome = dados.nome;
    if (dados.descricao !== undefined) campos.descricao = dados.descricao;
    if (dados.modulos !== undefined) campos.modulos = dados.modulos;
    if (dados.preco !== undefined) campos.preco = dados.preco;
    if (dados.periodicidade !== undefined) campos.periodicidade = dados.periodicidade;
    if (dados.dataValidade !== undefined) campos.data_validade = dados.dataValidade;
    if (dados.gratuito !== undefined) campos.gratuito = dados.gratuito;

    const { error } = await this.supabase.admin.from('pacotes_modulos').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar pacote: ${error.message}`);
  }

  async marcarAtivo(id: string, ativo: boolean): Promise<void> {
    const { error } = await this.supabase.admin.from('pacotes_modulos').update({ ativo }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao alterar status do pacote: ${error.message}`);
  }

  private mapear(linha: Linha): PacoteModulos {
    return {
      id: linha.id,
      nome: linha.nome,
      descricao: linha.descricao,
      modulos: linha.modulos,
      preco: Number(linha.preco),
      periodicidade: linha.periodicidade,
      dataValidade: linha.data_validade,
      gratuito: linha.gratuito,
      ativo: linha.ativo,
    };
  }
}
