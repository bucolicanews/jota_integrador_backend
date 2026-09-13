import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  ConfiguracaoFuncionario,
  ConfiguracaoFuncionarioRepositorioPort,
  DadosConfiguracaoFuncionario,
} from '../aplicacao/portas/configuracao-funcionario-repositorio.port';

interface LinhaConfiguracao {
  usuario_id: string;
  salario: number | null;
  horas_mensais: number;
  dias_folga_fixos: string[];
  folga_domingo_obrigatoria: boolean;
  data_inicio_contrato: string | null;
}

const COLUNAS = 'usuario_id, salario, horas_mensais, dias_folga_fixos, folga_domingo_obrigatoria, data_inicio_contrato';

@Injectable()
export class ConfiguracaoFuncionarioRepositorioSupabase implements ConfiguracaoFuncionarioRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async obterPorUsuario(usuarioId: string): Promise<ConfiguracaoFuncionario | null> {
    const { data, error } = await this.supabase.admin.from('ponto_configuracao_funcionario').select(COLUNAS).eq('usuario_id', usuarioId).maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar configuração de jornada: ${error.message}`);
    return data ? this.mapear(data as LinhaConfiguracao) : null;
  }

  async upsert(usuarioId: string, dados: DadosConfiguracaoFuncionario): Promise<ConfiguracaoFuncionario> {
    const campos: Record<string, unknown> = { usuario_id: usuarioId };
    if (dados.salario !== undefined) campos.salario = dados.salario;
    if (dados.horasMensais !== undefined) campos.horas_mensais = dados.horasMensais;
    if (dados.diasFolgaFixos !== undefined) campos.dias_folga_fixos = dados.diasFolgaFixos;
    if (dados.folgaDomingoObrigatoria !== undefined) campos.folga_domingo_obrigatoria = dados.folgaDomingoObrigatoria;
    if (dados.dataInicioContrato !== undefined) campos.data_inicio_contrato = dados.dataInicioContrato;

    const { data, error } = await this.supabase.admin
      .from('ponto_configuracao_funcionario')
      .upsert(campos, { onConflict: 'usuario_id' })
      .select(COLUNAS)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao salvar configuração de jornada: ${error.message}`);
    return this.mapear(data as LinhaConfiguracao);
  }

  private mapear(linha: LinhaConfiguracao): ConfiguracaoFuncionario {
    return {
      usuarioId: linha.usuario_id,
      salario: linha.salario,
      horasMensais: linha.horas_mensais,
      diasFolgaFixos: linha.dias_folga_fixos,
      folgaDomingoObrigatoria: linha.folga_domingo_obrigatoria,
      dataInicioContrato: linha.data_inicio_contrato,
    };
  }
}
