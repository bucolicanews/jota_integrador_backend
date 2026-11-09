import { Injectable } from '@nestjs/common';
import { SincronizarMetodo2faUseCase } from './sincronizar-metodo-2fa.usecase';

/**
 * Usuário escolhe não usar segundo fator -- opcional pra qualquer papel, inclusive
 * plataforma (docs/SEGURANCA.md §8, atualização 2026-11-09). Não desinscreve o fator
 * TOTP do Supabase por conta própria (isso é ação separada, client-side, `auth.mfa.unenroll`)
 * -- aqui só muda a PREFERÊNCIA, deixando de exigir o desafio.
 */
@Injectable()
export class DefinirMetodo2faNenhumUseCase {
  constructor(private readonly sincronizarMetodo2fa: SincronizarMetodo2faUseCase) {}

  async executar(usuarioId: string): Promise<void> {
    await this.sincronizarMetodo2fa.executar(usuarioId, 'nenhum');
  }
}
