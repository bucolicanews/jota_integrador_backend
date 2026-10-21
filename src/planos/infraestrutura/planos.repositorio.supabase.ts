import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { Periodicidade } from '../dominio/plano';
import {
  DadosAtualizacaoPlano,
  DadosNovoPlano,
  Plano,
  PlanosRepositorioPort,
} from '../aplicacao/portas/planos-repositorio.port';

interface LinhaPlano {
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

const COLUNAS_SELECT = 'id, nome, descricao, modulos, preco, periodicidade, data_validade, gratuito, ativo';

@Injectable()
export class PlanosRepositorioSupabase implements PlanosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoPlano): Promise<Plano> {
    const { data, error } = await this.supabase.admin
      .from('planos')
      .insert({
        nome: dados.nome,
        descricao: dados.descricao,
        // operacoes_incluidas não é mais editável (substituído por plano_consultas_incluidas,
        // ver VerificarCotaIncluidaUseCase) -- sempre 0, coluna mantida só por compatibilidade.
        operacoes_incluidas: 0,
        modulos: dados.modulos,
        preco: dados.preco,
        periodicidade: dados.periodicidade,
        data_validade: dados.dataValidade,
        gratuito: dados.gratuito,
      })
      .select(COLUNAS_SELECT)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar plano: ${error?.message}`);
    }
    return this.mapear(data as LinhaPlano);
  }

  async buscarPorId(id: string): Promise<Plano | null> {
    const { data, error } = await this.supabase.admin
      .from('planos')
      .select(COLUNAS_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar plano: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaPlano) : null;
  }

  async listar(somenteAtivos: boolean): Promise<Plano[]> {
    let query = this.supabase.admin.from('planos').select(COLUNAS_SELECT).order('preco', { ascending: true });
    if (somenteAtivos) {
      query = query.eq('ativo', true);
    }
    const { data, error } = await query;

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar planos: ${error.message}`);
    }
    return (data as LinhaPlano[]).map((linha) => this.mapear(linha));
  }

  async atualizar(id: string, dados: DadosAtualizacaoPlano): Promise<Plano> {
    const campos: Record<string, unknown> = {};
    if (dados.nome !== undefined) campos.nome = dados.nome;
    if (dados.descricao !== undefined) campos.descricao = dados.descricao;
    if (dados.modulos !== undefined) campos.modulos = dados.modulos;
    if (dados.preco !== undefined) campos.preco = dados.preco;
    if (dados.ativo !== undefined) campos.ativo = dados.ativo;
    if (dados.dataValidade !== undefined) campos.data_validade = dados.dataValidade;
    if (dados.gratuito !== undefined) campos.gratuito = dados.gratuito;

    const { data, error } = await this.supabase.admin
      .from('planos')
      .update(campos)
      .eq('id', id)
      .select(COLUNAS_SELECT)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao atualizar plano: ${error?.message}`);
    }
    return this.mapear(data as LinhaPlano);
  }

  private mapear(linha: LinhaPlano): Plano {
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
