import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { TipoRegistroPonto } from '../dominio/ponto';
import {
  DadosNovoRegistro,
  FiltroRegistros,
  RegistroPonto,
  RegistrosPontoRepositorioPort,
} from '../aplicacao/portas/registros-ponto-repositorio.port';

interface LinhaRegistro {
  id: string;
  usuario_id: string;
  contador_id: string | null;
  empresa_id: string | null;
  tipo: TipoRegistroPonto;
  horario_registro: string;
  selfie_storage_ref: string | null;
  latitude: number | null;
  longitude: number | null;
  ajuste_manual: boolean;
  minutos_credito: number | null;
  atestado_storage_ref: string | null;
  observacao: string | null;
  criado_por: string;
  criado_em: string;
}

const COLUNAS =
  'id, usuario_id, contador_id, empresa_id, tipo, horario_registro, selfie_storage_ref, latitude, longitude, ajuste_manual, minutos_credito, atestado_storage_ref, observacao, criado_por, criado_em';

@Injectable()
export class RegistrosPontoRepositorioSupabase implements RegistrosPontoRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoRegistro): Promise<RegistroPonto> {
    const { data, error } = await this.supabase.admin
      .from('ponto_registros')
      .insert({
        usuario_id: dados.usuarioId,
        contador_id: dados.contadorId,
        empresa_id: dados.empresaId,
        tipo: dados.tipo,
        horario_registro: dados.horarioRegistro,
        selfie_storage_ref: dados.selfieStorageRef ?? null,
        latitude: dados.latitude ?? null,
        longitude: dados.longitude ?? null,
        ajuste_manual: dados.ajusteManual ?? false,
        minutos_credito: dados.minutosCredito ?? null,
        atestado_storage_ref: dados.atestadoStorageRef ?? null,
        observacao: dados.observacao ?? null,
        criado_por: dados.criadoPor,
      })
      .select(COLUNAS)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao criar registro de ponto: ${error.message}`);
    return this.mapear(data as LinhaRegistro);
  }

  async listar(filtro: FiltroRegistros): Promise<RegistroPonto[]> {
    const { data, error } = await this.supabase.admin
      .from('ponto_registros')
      .select(COLUNAS)
      .eq('usuario_id', filtro.usuarioId)
      .gte('horario_registro', filtro.inicio)
      .lt('horario_registro', filtro.fim)
      .order('horario_registro', { ascending: true });
    if (error) throw new InternalServerErrorException(`Falha ao listar registros de ponto: ${error.message}`);
    return (data as LinhaRegistro[]).map((linha) => this.mapear(linha));
  }

  async obterPorId(id: string): Promise<RegistroPonto | null> {
    const { data, error } = await this.supabase.admin.from('ponto_registros').select(COLUNAS).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar registro de ponto: ${error.message}`);
    return data ? this.mapear(data as LinhaRegistro) : null;
  }

  async obterUltimaBatidaDoDia(usuarioId: string, inicioDia: string, fimDia: string): Promise<RegistroPonto | null> {
    const { data, error } = await this.supabase.admin
      .from('ponto_registros')
      .select(COLUNAS)
      .eq('usuario_id', usuarioId)
      .in('tipo', ['entrada', 'saida'])
      .gte('horario_registro', inicioDia)
      .lt('horario_registro', fimDia)
      .order('horario_registro', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar última batida: ${error.message}`);
    return data ? this.mapear(data as LinhaRegistro) : null;
  }

  async excluirBatidasDoDia(usuarioId: string, inicioDia: string, fimDia: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('ponto_registros')
      .delete()
      .eq('usuario_id', usuarioId)
      .in('tipo', ['entrada', 'saida'])
      .gte('horario_registro', inicioDia)
      .lt('horario_registro', fimDia);
    if (error) throw new InternalServerErrorException(`Falha ao excluir batidas do dia: ${error.message}`);
  }

  async excluir(id: string): Promise<void> {
    const { error } = await this.supabase.admin.from('ponto_registros').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Falha ao excluir registro de ponto: ${error.message}`);
  }

  private mapear(linha: LinhaRegistro): RegistroPonto {
    return {
      id: linha.id,
      usuarioId: linha.usuario_id,
      contadorId: linha.contador_id,
      empresaId: linha.empresa_id,
      tipo: linha.tipo,
      horarioRegistro: linha.horario_registro,
      selfieStorageRef: linha.selfie_storage_ref,
      latitude: linha.latitude,
      longitude: linha.longitude,
      ajusteManual: linha.ajuste_manual,
      minutosCredito: linha.minutos_credito,
      atestadoStorageRef: linha.atestado_storage_ref,
      observacao: linha.observacao,
      criadoPor: linha.criado_por,
      criadoEm: linha.criado_em,
    };
  }
}
