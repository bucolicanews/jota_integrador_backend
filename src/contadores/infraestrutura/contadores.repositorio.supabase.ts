import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { StatusContador, TipoContador } from '../dominio/contador';
import {
  Contador,
  ContadoresRepositorioPort,
  DadosAtualizacaoContador,
  DadosNovoContador,
} from '../aplicacao/portas/contadores-repositorio.port';

interface LinhaContador {
  id: string;
  nome: string;
  cnpj_cpf: string;
  email: string;
  telefone: string | null;
  tipo: TipoContador;
  status: StatusContador;
  bloqueado: boolean;
  stripe_customer_id: string | null;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_details_submitted: boolean;
  pagbank_account_id: string | null;
}

const COLUNAS_SELECT =
  'id, nome, cnpj_cpf, email, telefone, tipo, status, bloqueado, stripe_customer_id, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted, pagbank_account_id';

@Injectable()
export class ContadoresRepositorioSupabase implements ContadoresRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoContador): Promise<Contador> {
    // Nunca `.insert({...body})` -- lista explícita de campos. `tipo` sempre 'humano'
    // aqui (default da coluna) -- 'interno_jota' não é criado via este caminho.
    const { data, error } = await this.supabase.admin
      .from('contadores')
      .insert({
        nome: dados.nome,
        cnpj_cpf: dados.cnpjCpf,
        email: dados.email,
        telefone: dados.telefone,
      })
      .select(COLUNAS_SELECT)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar contador: ${error?.message}`);
    }

    return this.mapear(data as LinhaContador);
  }

  async buscarPorId(id: string): Promise<Contador | null> {
    const { data, error } = await this.supabase.admin
      .from('contadores')
      .select(COLUNAS_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar contador: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaContador) : null;
  }

  async buscarPorCnpjCpf(cnpjCpf: string): Promise<Contador | null> {
    const { data, error } = await this.supabase.admin
      .from('contadores')
      .select(COLUNAS_SELECT)
      .eq('cnpj_cpf', cnpjCpf)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar contador por CPF/CNPJ: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaContador) : null;
  }

  async atualizarCnpjCpf(id: string, cnpjCpf: string): Promise<void> {
    const { error } = await this.supabase.admin.from('contadores').update({ cnpj_cpf: cnpjCpf }).eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao corrigir CPF/CNPJ: ${error.message}`);
    }
  }

  async listar(): Promise<Contador[]> {
    const { data, error } = await this.supabase.admin
      .from('contadores')
      .select(COLUNAS_SELECT)
      .order('nome', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar contadores: ${error.message}`);
    }
    return (data as LinhaContador[]).map((linha) => this.mapear(linha));
  }

  async atualizar(id: string, dados: DadosAtualizacaoContador): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.nome !== undefined) campos.nome = dados.nome;
    if (dados.telefone !== undefined) campos.telefone = dados.telefone;
    if (dados.email !== undefined) campos.email = dados.email;

    const { error } = await this.supabase.admin.from('contadores').update(campos).eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar contador: ${error.message}`);
    }
  }

  async marcarBloqueio(
    id: string,
    bloqueado: boolean,
    motivo: string | null,
    executadoPorId: string,
  ): Promise<void> {
    const { error } = await this.supabase.admin
      .from('contadores')
      .update({
        bloqueado,
        bloqueado_em: bloqueado ? new Date().toISOString() : null,
        bloqueado_motivo: bloqueado ? motivo : null,
        bloqueado_por: bloqueado ? executadoPorId : null,
      })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao alterar bloqueio do contador: ${error.message}`);
    }
  }

  async atualizarStripeCustomerId(id: string, stripeCustomerId: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('contadores')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar stripe_customer_id: ${error.message}`);
    }
  }

  async atualizarStripeAccountId(id: string, stripeAccountId: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('contadores')
      .update({ stripe_account_id: stripeAccountId })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar stripe_account_id: ${error.message}`);
    }
  }

  async atualizarStatusStripeConnect(
    id: string,
    status: { chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean },
  ): Promise<void> {
    const { error } = await this.supabase.admin
      .from('contadores')
      .update({
        stripe_charges_enabled: status.chargesEnabled,
        stripe_payouts_enabled: status.payoutsEnabled,
        stripe_details_submitted: status.detailsSubmitted,
      })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar status Stripe Connect: ${error.message}`);
    }
  }

  async atualizarPagbankAccountId(id: string, pagbankAccountId: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('contadores')
      .update({ pagbank_account_id: pagbankAccountId })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar pagbank_account_id: ${error.message}`);
    }
  }

  /**
   * Checa carteira de clientes, login, atividade comercial/financeira do próprio
   * contador e da empresa interna dele -- nenhuma dessas tabelas tem FK com ON DELETE
   * CASCADE pra contadores/empresas (de propósito, ver docs/SEGURANCA.md), então excluir
   * sem checar antes só devolveria um 500 de violação de FK no meio do caminho.
   */
  async verificarImpedimentosExclusao(id: string): Promise<string[]> {
    const impedimentos: string[] = [];

    const { count: totalClientes } = await this.supabase.admin
      .from('empresas')
      .select('id', { count: 'exact', head: true })
      .eq('contador_id', id)
      .eq('tipo', 'cliente');
    if ((totalClientes ?? 0) > 0) {
      impedimentos.push(`Carteira não está vazia (${totalClientes} empresa(s) cliente) -- transfira ou remova antes`);
    }

    const { count: totalLogins } = await this.supabase.admin
      .from('usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('contador_id', id);
    if ((totalLogins ?? 0) > 0) {
      impedimentos.push(`Existe(m) ${totalLogins} login(s) vinculado(s) a este contador`);
    }

    const tabelasAtividade: Array<{ tabela: string; rotulo: string }> = [
      { tabela: 'assinaturas', rotulo: 'assinatura' },
      { tabela: 'licencas_modulo', rotulo: 'licença de módulo' },
      { tabela: 'cobrancas_honorarios', rotulo: 'cobrança de honorário' },
      { tabela: 'faturas', rotulo: 'fatura' },
      { tabela: 'planos_revenda_creditos', rotulo: 'plano de revenda de créditos' },
      { tabela: 'planos_revenda_pacote', rotulo: 'plano de revenda de pacote' },
      { tabela: 'pagamentos_assinatura_creditos', rotulo: 'pagamento de assinatura' },
      { tabela: 'pagamentos_ativacao_licenca', rotulo: 'pagamento de ativação de licença' },
      { tabela: 'consultas_serpro', rotulo: 'consulta ao SERPRO' },
      { tabela: 'creditos_movimentos', rotulo: 'movimento de crédito' },
      { tabela: 'suporte_tickets', rotulo: 'ticket de suporte' },
      { tabela: 'ponto_registros', rotulo: 'registro de ponto' },
      { tabela: 'ponto_ferias', rotulo: 'férias' },
    ];
    for (const { tabela, rotulo } of tabelasAtividade) {
      const { count } = await this.supabase.admin.from(tabela).select('id', { count: 'exact', head: true }).eq('contador_id', id);
      if ((count ?? 0) > 0) {
        impedimentos.push(`Existe(m) ${count} registro(s) de ${rotulo} vinculado(s) a este contador`);
      }
    }

    const empresaInterna = await this.buscarEmpresaInternaId(id);
    if (empresaInterna) {
      const tabelasBookkeeping: Array<{ tabela: string; coluna: string; rotulo: string }> = [
        { tabela: 'lancamentos_contabeis', coluna: 'empresa_id', rotulo: 'lançamento contábil' },
        { tabela: 'contratos_gerados', coluna: 'empresa_id', rotulo: 'contrato' },
        { tabela: 'contas_pagar', coluna: 'empresa_id', rotulo: 'conta a pagar' },
        { tabela: 'contas_receber', coluna: 'empresa_id', rotulo: 'conta a receber' },
      ];
      for (const { tabela, coluna, rotulo } of tabelasBookkeeping) {
        const { count } = await this.supabase.admin.from(tabela).select('id', { count: 'exact', head: true }).eq(coluna, empresaInterna);
        if ((count ?? 0) > 0) {
          impedimentos.push(`A empresa interna deste contador tem ${count} ${rotulo}(ns) registrado(s)`);
        }
      }
    }

    return impedimentos;
  }

  /** Só chamar depois de `verificarImpedimentosExclusao` devolver vazio. */
  async remover(id: string): Promise<void> {
    const empresaInterna = await this.buscarEmpresaInternaId(id);

    // Preserva o rastro de auditoria (dados antigos ficam no JSON do log) sem deixar um
    // FK pendurado numa linha que vai deixar de existir -- contador_id é nullable.
    await this.supabase.admin.from('logs_auditoria').update({ contador_id: null }).eq('contador_id', id);

    if (empresaInterna) {
      await this.supabase.admin.from('configuracao_contratos').delete().eq('empresa_id', empresaInterna);
      await this.supabase.admin.from('plano_contas').delete().eq('empresa_id', empresaInterna);
      const { error: erroEmpresa } = await this.supabase.admin.from('empresas').delete().eq('id', empresaInterna);
      if (erroEmpresa) {
        throw new InternalServerErrorException(`Falha ao excluir empresa interna do contador: ${erroEmpresa.message}`);
      }
    }

    const { error } = await this.supabase.admin.from('contadores').delete().eq('id', id);
    if (error) {
      throw new InternalServerErrorException(`Falha ao excluir contador: ${error.message}`);
    }
  }

  private async buscarEmpresaInternaId(contadorId: string): Promise<string | null> {
    const { data } = await this.supabase.admin
      .from('empresas')
      .select('id')
      .eq('contador_id', contadorId)
      .eq('tipo', 'interna_contador')
      .maybeSingle();
    return data?.id ?? null;
  }

  private mapear(linha: LinhaContador): Contador {
    return {
      id: linha.id,
      nome: linha.nome,
      cnpjCpf: linha.cnpj_cpf,
      email: linha.email,
      telefone: linha.telefone,
      tipo: linha.tipo,
      status: linha.status,
      bloqueado: linha.bloqueado,
      stripeCustomerId: linha.stripe_customer_id,
      stripeAccountId: linha.stripe_account_id,
      stripeChargesEnabled: linha.stripe_charges_enabled,
      stripePayoutsEnabled: linha.stripe_payouts_enabled,
      stripeDetailsSubmitted: linha.stripe_details_submitted,
      pagbankAccountId: linha.pagbank_account_id,
    };
  }
}
