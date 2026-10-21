import { BadRequestException, ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { ModoAcessoSerpro, RegimeTributario, StatusEmpresa, TipoEmpresa } from '../dominio/empresa';
import {
  DadosAtualizacaoEmpresa,
  DadosNovaEmpresa,
  Empresa,
  EmpresasRepositorioPort,
} from '../aplicacao/portas/empresas-repositorio.port';

interface LinhaEmpresa {
  id: string;
  contador_id: string;
  tipo: TipoEmpresa;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  regime_tributario: RegimeTributario | null;
  modo_acesso_serpro: ModoAcessoSerpro;
  status: StatusEmpresa;
  bloqueado: boolean;
}

const COLUNAS_SELECT =
  'id, contador_id, tipo, razao_social, nome_fantasia, cnpj, regime_tributario, modo_acesso_serpro, status, bloqueado';

@Injectable()
export class EmpresasRepositorioSupabase implements EmpresasRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovaEmpresa): Promise<Empresa> {
    // Nunca `.insert({...body})` -- lista explícita de campos (regra de mass assignment).
    const { data, error } = await this.supabase.admin
      .from('empresas')
      .insert({
        contador_id: dados.contadorId,
        tipo: dados.tipo ?? 'cliente',
        razao_social: dados.razaoSocial,
        nome_fantasia: dados.nomeFantasia,
        cnpj: dados.cnpj,
        regime_tributario: dados.regimeTributario,
        modo_acesso_serpro: dados.modoAcessoSerpro,
      })
      .select(COLUNAS_SELECT)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar empresa: ${error?.message}`);
    }

    return this.mapear(data as LinhaEmpresa);
  }

  async buscarPorId(id: string): Promise<Empresa | null> {
    const { data, error } = await this.supabase.admin
      .from('empresas')
      .select(COLUNAS_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar empresa: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaEmpresa) : null;
  }

  async listarPorContador(contadorId: string): Promise<Empresa[]> {
    // Só empresas-cliente de verdade -- a empresa interna do próprio contador nunca aparece
    // misturada na carteira (ela não é um cliente, é a contabilidade do próprio contador).
    const { data, error } = await this.supabase.admin
      .from('empresas')
      .select(COLUNAS_SELECT)
      .eq('contador_id', contadorId)
      .eq('tipo', 'cliente')
      .order('razao_social', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar empresas: ${error.message}`);
    }
    return (data as LinhaEmpresa[]).map((linha) => this.mapear(linha));
  }

  async buscarEmpresaInternaDoContador(contadorId: string): Promise<Empresa | null> {
    const { data, error } = await this.supabase.admin
      .from('empresas')
      .select(COLUNAS_SELECT)
      .eq('contador_id', contadorId)
      .eq('tipo', 'interna_contador')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar empresa interna do contador: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaEmpresa) : null;
  }

  async buscarEmpresaInternaDaPlataforma(): Promise<Empresa | null> {
    const { data, error } = await this.supabase.admin
      .from('empresas')
      .select(COLUNAS_SELECT)
      .eq('tipo', 'interna_plataforma')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar empresa interna da plataforma: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaEmpresa) : null;
  }

  async listarAtivasPorRegime(regimes: RegimeTributario[]): Promise<Empresa[]> {
    const { data, error } = await this.supabase.admin
      .from('empresas')
      .select(COLUNAS_SELECT)
      .eq('tipo', 'cliente')
      .eq('status', 'ativo')
      .eq('bloqueado', false)
      .in('regime_tributario', regimes);

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar empresas por regime tributário: ${error.message}`);
    }
    return (data as LinhaEmpresa[]).map((linha) => this.mapear(linha));
  }

  async pertenceAoContador(empresaId: string, contadorId: string): Promise<boolean> {
    const { data, error } = await this.supabase.admin
      .from('empresas')
      .select('id')
      .eq('id', empresaId)
      .eq('contador_id', contadorId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao checar posse da empresa: ${error.message}`);
    }
    return data !== null;
  }

  async atualizar(id: string, dados: DadosAtualizacaoEmpresa): Promise<void> {
    // Whitelist explícita -- mesmo se `dados` viesse maior por engano, só estes 3 campos
    // são enviados ao banco (nunca contador_id/bloqueado/modo_acesso_serpro por aqui).
    const campos: Record<string, unknown> = {};
    if (dados.razaoSocial !== undefined) campos.razao_social = dados.razaoSocial;
    if (dados.nomeFantasia !== undefined) campos.nome_fantasia = dados.nomeFantasia;
    if (dados.regimeTributario !== undefined) campos.regime_tributario = dados.regimeTributario;

    const { error } = await this.supabase.admin.from('empresas').update(campos).eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar empresa: ${error.message}`);
    }
  }

  async atualizarCnpj(id: string, cnpj: string): Promise<void> {
    const { error } = await this.supabase.admin.from('empresas').update({ cnpj }).eq('id', id);

    if (error) {
      // 23505 = violação do unique index em empresas.cnpj -- conflito de negócio (409),
      // não bug nosso (500), por isso a exceção diferente aqui.
      if (error.code === '23505') {
        throw new ConflictException('CNPJ já cadastrado em outra empresa');
      }
      throw new InternalServerErrorException(`Falha ao corrigir CNPJ: ${error.message}`);
    }
  }

  async atualizarContadorId(id: string, contadorId: string): Promise<void> {
    const { error } = await this.supabase.admin.from('empresas').update({ contador_id: contadorId }).eq('id', id);

    if (error) {
      // 23503 = violação da FK empresas.contador_id -> contadores.id (contador inexistente).
      if (error.code === '23503') {
        throw new BadRequestException('Contador informado não existe');
      }
      throw new InternalServerErrorException(`Falha ao transferir carteira: ${error.message}`);
    }
  }

  async atualizarModoAcessoSerpro(id: string, modo: ModoAcessoSerpro): Promise<void> {
    const { error } = await this.supabase.admin
      .from('empresas')
      .update({ modo_acesso_serpro: modo })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar modo de acesso SERPRO: ${error.message}`);
    }
  }

  async marcarBloqueio(
    id: string,
    bloqueado: boolean,
    motivo: string | null,
    executadoPorId: string,
  ): Promise<void> {
    const { error } = await this.supabase.admin
      .from('empresas')
      .update({
        bloqueado,
        bloqueado_em: bloqueado ? new Date().toISOString() : null,
        bloqueado_motivo: bloqueado ? motivo : null,
        bloqueado_por: bloqueado ? executadoPorId : null,
      })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao alterar bloqueio da empresa: ${error.message}`);
    }
  }

  private mapear(linha: LinhaEmpresa): Empresa {
    return {
      id: linha.id,
      contadorId: linha.contador_id,
      tipo: linha.tipo,
      razaoSocial: linha.razao_social,
      nomeFantasia: linha.nome_fantasia,
      cnpj: linha.cnpj,
      regimeTributario: linha.regime_tributario,
      modoAcessoSerpro: linha.modo_acesso_serpro,
      status: linha.status,
      bloqueado: linha.bloqueado,
    };
  }
}
