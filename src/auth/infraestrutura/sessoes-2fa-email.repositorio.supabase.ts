import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { Sessoes2faEmailRepositorioPort } from '../aplicacao/portas/sessoes-2fa-email-repositorio.port';

@Injectable()
export class Sessoes2faEmailRepositorioSupabase implements Sessoes2faEmailRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async estaVerificada(sessionId: string): Promise<boolean> {
    const { data, error } = await this.supabase.admin
      .from('sessoes_2fa_email_verificadas')
      .select('expira_em')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao checar sessão verificada (2FA email): ${error.message}`);
    }
    if (!data) return false;
    return new Date(data.expira_em).getTime() > Date.now();
  }

  async marcarVerificada(sessionId: string, usuarioId: string, duracaoMs: number): Promise<void> {
    const { error } = await this.supabase.admin.from('sessoes_2fa_email_verificadas').upsert({
      session_id: sessionId,
      usuario_id: usuarioId,
      verificado_em: new Date().toISOString(),
      expira_em: new Date(Date.now() + duracaoMs).toISOString(),
    });

    if (error) {
      throw new InternalServerErrorException(`Falha ao marcar sessão verificada (2FA email): ${error.message}`);
    }
  }
}
