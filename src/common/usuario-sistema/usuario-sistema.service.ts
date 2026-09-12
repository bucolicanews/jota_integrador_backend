import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

const EMAIL_SISTEMA = 'sistema@jota.internal';
const PAPEL_SISTEMA = 'SUPER_ADMIN';

/**
 * Ator técnico usado como `criado_por` em lançamentos 100% automáticos (ex: webhook Stripe
 * sem usuário humano na requisição) -- registro real em auth.users/usuarios porque as FKs de
 * auditoria (contas_pagar.criado_por, lancamentos_contabeis.criado_por etc.) exigem um usuário
 * de verdade, não dá pra apontar pra um UUID inventado via migration (ver docs/BANCO_DE_DADOS.md).
 * Senha é descartada na criação -- este usuário nunca faz login interativo.
 */
@Injectable()
export class UsuarioSistemaService {
  private readonly logger = new Logger(UsuarioSistemaService.name);
  private idEmCache: string | null = null;

  constructor(private readonly supabase: SupabaseService) {}

  async obterOuCriarId(): Promise<string> {
    if (this.idEmCache) return this.idEmCache;

    const existente = await this.supabase.admin.from('usuarios').select('id').eq('email', EMAIL_SISTEMA).maybeSingle();
    if (existente.error) throw new InternalServerErrorException(`Falha ao buscar usuário-sistema: ${existente.error.message}`);
    if (existente.data) {
      this.idEmCache = existente.data.id as string;
      return this.idEmCache;
    }

    const { data: authData, error: authError } = await this.supabase.admin.auth.admin.createUser({
      email: EMAIL_SISTEMA,
      password: `${randomUUID()}${randomUUID()}`,
      email_confirm: true,
      app_metadata: { papel: PAPEL_SISTEMA },
    });
    if (authError || !authData.user) {
      throw new InternalServerErrorException(`Falha ao criar usuário-sistema: ${authError?.message}`);
    }

    const papel = await this.supabase.admin.from('papeis').select('id').eq('nome', PAPEL_SISTEMA).single();
    if (papel.error || !papel.data) {
      throw new InternalServerErrorException(`Papel ${PAPEL_SISTEMA} não encontrado ao criar usuário-sistema: ${papel.error?.message}`);
    }

    const inserido = await this.supabase.admin
      .from('usuarios')
      .insert({ id: authData.user.id, nome: 'Sistema (automações)', email: EMAIL_SISTEMA, papel_id: papel.data.id as string })
      .select('id')
      .single();
    if (inserido.error) {
      throw new InternalServerErrorException(`Falha ao criar registro usuarios do usuário-sistema: ${inserido.error.message}`);
    }

    this.logger.log(`Usuário-sistema criado (${authData.user.id}).`);
    this.idEmCache = authData.user.id;
    return this.idEmCache;
  }
}
