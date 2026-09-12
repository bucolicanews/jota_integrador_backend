import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { StatusLicenca } from '../dominio/licenca-modulo';
import { DadosNovaLicenca, LicencaModulo, LicencasModuloRepositorioPort } from '../aplicacao/portas/licencas-modulo-repositorio.port';

interface Linha {
  id: string;
  contador_id: string;
  pacote_id: string;
  empresa_id: string | null;
  status: StatusLicenca;
  stripe_subscription_id: string | null;
  ativado_em: string | null;
  criado_em: string;
}

const COLUNAS = 'id, contador_id, pacote_id, empresa_id, status, stripe_subscription_id, ativado_em, criado_em';

@Injectable()
export class LicencasModuloRepositorioSupabase implements LicencasModuloRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovaLicenca): Promise<LicencaModulo> {
    const { data, error } = await this.supabase.admin
      .from('licencas_modulo')
      .insert({ contador_id: dados.contadorId, pacote_id: dados.pacoteId, stripe_subscription_id: dados.stripeSubscriptionId })
      .select(COLUNAS)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar licença: ${error.message}`);
    return this.mapear(data as Linha);
  }

  async listarPorContador(contadorId: string): Promise<LicencaModulo[]> {
    const { data, error } = await this.supabase.admin.from('licencas_modulo').select(COLUNAS).eq('contador_id', contadorId).order('criado_em', { ascending: false });
    if (error) throw new InternalServerErrorException(`Falha ao listar licenças: ${error.message}`);
    return (data as Linha[]).map((linha) => this.mapear(linha));
  }

  async obterPorId(id: string): Promise<LicencaModulo | null> {
    const { data, error } = await this.supabase.admin.from('licencas_modulo').select(COLUNAS).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar licença: ${error.message}`);
    return data ? this.mapear(data as Linha) : null;
  }

  async buscarPorStripeSubscriptionId(stripeSubscriptionId: string): Promise<LicencaModulo | null> {
    const { data, error } = await this.supabase.admin.from('licencas_modulo').select(COLUNAS).eq('stripe_subscription_id', stripeSubscriptionId).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar licença por subscription: ${error.message}`);
    return data ? this.mapear(data as Linha) : null;
  }

  async ativar(id: string, empresaId: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('licencas_modulo')
      .update({ empresa_id: empresaId, status: 'ativa', ativado_em: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao ativar licença: ${error.message}`);
  }

  async desativar(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('licencas_modulo').update({ status: 'disponivel', empresa_id: null, ativado_em: null }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao desativar licença: ${error.message}`);
  }

  async cancelar(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('licencas_modulo').update({ status: 'cancelada' }).eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao cancelar licença: ${error.message}`);
  }

  async jaProcessouEventoWebhook(gateway: string, eventoId: string): Promise<boolean> {
    const { data, error } = await this.supabase.admin.from('webhook_eventos_processados').select('id').eq('gateway', gateway).eq('evento_id', eventoId).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao checar idempotência de webhook: ${error.message}`);
    return data !== null;
  }

  async marcarEventoWebhookProcessado(gateway: string, eventoId: string): Promise<void> {
    const { error } = await this.supabase.admin.from('webhook_eventos_processados').insert({ gateway, evento_id: eventoId });
    if (error && error.code !== '23505') throw new InternalServerErrorException(`Falha ao marcar webhook processado: ${error.message}`);
  }

  private mapear(linha: Linha): LicencaModulo {
    return {
      id: linha.id,
      contadorId: linha.contador_id,
      pacoteId: linha.pacote_id,
      empresaId: linha.empresa_id,
      status: linha.status,
      stripeSubscriptionId: linha.stripe_subscription_id,
      ativadoEm: linha.ativado_em,
      criadoEm: linha.criado_em,
    };
  }
}
