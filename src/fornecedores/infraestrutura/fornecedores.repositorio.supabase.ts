import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { DadosFornecedor, Fornecedor, FornecedoresRepositorioPort } from '../aplicacao/portas/fornecedores-repositorio.port';

interface Linha {
  id: string;
  empresa_id: string;
  nome: string;
  razao_social: string | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  ativo: boolean;
}

const COLUNAS = 'id, empresa_id, nome, razao_social, documento, email, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, ativo';

@Injectable()
export class FornecedoresRepositorioSupabase implements FornecedoresRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosFornecedor): Promise<Fornecedor> {
    const { data, error } = await this.supabase.admin
      .from('fornecedores')
      .insert({
        empresa_id: dados.empresaId,
        nome: dados.nome,
        razao_social: dados.razaoSocial ?? null,
        documento: dados.documento ?? null,
        email: dados.email ?? null,
        telefone: dados.telefone ?? null,
        cep: dados.cep ?? null,
        endereco: dados.endereco ?? null,
        numero: dados.numero ?? null,
        complemento: dados.complemento ?? null,
        bairro: dados.bairro ?? null,
        cidade: dados.cidade ?? null,
        estado: dados.estado ?? null,
      })
      .select(COLUNAS)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar fornecedor: ${error.message}`);
    return this.mapear(data as Linha);
  }

  async listarPorEmpresa(empresaId: string, apenasAtivos?: boolean): Promise<Fornecedor[]> {
    let query = this.supabase.admin.from('fornecedores').select(COLUNAS).eq('empresa_id', empresaId).order('nome');
    if (apenasAtivos) query = query.eq('ativo', true);
    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(`Falha ao listar fornecedores: ${error.message}`);
    return (data as Linha[]).map((linha) => this.mapear(linha));
  }

  async obterPorId(id: string): Promise<Fornecedor | null> {
    const { data, error } = await this.supabase.admin.from('fornecedores').select(COLUNAS).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar fornecedor: ${error.message}`);
    return data ? this.mapear(data as Linha) : null;
  }

  async atualizar(id: string, dados: Partial<DadosFornecedor>): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.nome !== undefined) campos.nome = dados.nome;
    if (dados.razaoSocial !== undefined) campos.razao_social = dados.razaoSocial;
    if (dados.documento !== undefined) campos.documento = dados.documento;
    if (dados.email !== undefined) campos.email = dados.email;
    if (dados.telefone !== undefined) campos.telefone = dados.telefone;
    if (dados.cep !== undefined) campos.cep = dados.cep;
    if (dados.endereco !== undefined) campos.endereco = dados.endereco;
    if (dados.numero !== undefined) campos.numero = dados.numero;
    if (dados.complemento !== undefined) campos.complemento = dados.complemento;
    if (dados.bairro !== undefined) campos.bairro = dados.bairro;
    if (dados.cidade !== undefined) campos.cidade = dados.cidade;
    if (dados.estado !== undefined) campos.estado = dados.estado;

    const { error } = await this.supabase.admin.from('fornecedores').update(campos).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar fornecedor: ${error.message}`);
  }

  async marcarAtivo(id: string, ativo: boolean): Promise<void> {
    const { error } = await this.supabase.admin.from('fornecedores').update({ ativo }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao atualizar status do fornecedor: ${error.message}`);
  }

  private mapear(linha: Linha): Fornecedor {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      nome: linha.nome,
      razaoSocial: linha.razao_social,
      documento: linha.documento,
      email: linha.email,
      telefone: linha.telefone,
      cep: linha.cep,
      endereco: linha.endereco,
      numero: linha.numero,
      complemento: linha.complemento,
      bairro: linha.bairro,
      cidade: linha.cidade,
      estado: linha.estado,
      ativo: linha.ativo,
    };
  }
}
