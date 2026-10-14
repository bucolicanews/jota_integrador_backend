import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { StatusAssinatura } from '../dominio/assinatura';
import {
  Assinatura,
  AssinaturasRepositorioPort,
  DadosAtualizacaoAssinatura,
  DadosNovaAssinatura,
} from '../aplicacao/portas/assinaturas-repositorio.port';

interface Linha {
  id: string;
  contador_id: string;
  empresa_id: string;
  plano_id: string;
  plano_revenda_id: string | null;
  status: StatusAssinatura;
  inicio_em: string;
  fim_em: string | null;
}

const COLUNAS = 'id, contador_id, empresa_id, plano_id, plano_revenda_id, status, inicio_em, fim_em';

@Injectable()
export class AssinaturasRepositorioSupabase implements AssinaturasRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async buscarPorEmpresa(empresaId: string): Promise<Assinatura | null> {
    const { data, error } = await this.supabase.admin
      .from('assinaturas')
      .select(COLUNAS)
      .eq('empresa_id', empresaId)
      .neq('status', 'cancelada')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar assinatura: ${error.message}`);
    }
    return data ? this.mapear(data as Linha) : null;
  }

  async buscarAtivaPorEmpresa(empresaId: string): Promise<Assinatura | null> {
    const { data, error } = await this.supabase.admin
      .from('assinaturas')
      .select(COLUNAS)
      .eq('empresa_id', empresaId)
      .eq('status', 'ativa')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar assinatura ativa: ${error.message}`);
    }
    return data ? this.mapear(data as Linha) : null;
  }

  async criar(dados: DadosNovaAssinatura): Promise<Assinatura> {
    const { data, error } = await this.supabase.admin
      .from('assinaturas')
      .insert({
        contador_id: dados.contadorId,
        empresa_id: dados.empresaId,
        plano_id: dados.planoId,
        plano_revenda_id: dados.planoRevendaId,
        status: 'ativa',
      })
      .select(COLUNAS)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar assinatura: ${error?.message}`);
    }
    return this.mapear(data as Linha);
  }

  async atualizar(id: string, dados: DadosAtualizacaoAssinatura): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.planoId !== undefined) campos.plano_id = dados.planoId;
    if (dados.planoRevendaId !== undefined) campos.plano_revenda_id = dados.planoRevendaId;

    const { error } = await this.supabase.admin.from('assinaturas').update(campos).eq('id', id);
    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar assinatura: ${error.message}`);
    }
  }

  async atualizarStatus(id: string, status: StatusAssinatura): Promise<void> {
    const { error } = await this.supabase.admin.from('assinaturas').update({ status }).eq('id', id);
    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar status da assinatura: ${error.message}`);
    }
  }

  private mapear(linha: Linha): Assinatura {
    return {
      id: linha.id,
      contadorId: linha.contador_id,
      empresaId: linha.empresa_id,
      planoId: linha.plano_id,
      planoRevendaId: linha.plano_revenda_id,
      status: linha.status,
      inicioEm: linha.inicio_em,
      fimEm: linha.fim_em,
    };
  }
}
