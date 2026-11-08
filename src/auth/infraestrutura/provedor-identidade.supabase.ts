import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  ClaimsIdentidade,
  IdentidadeValidada,
  ProvedorIdentidadePort,
  ResultadoCriarUsuarioComConvite,
} from '../aplicacao/portas/provedor-identidade.port';
import { EscopoPapel, Papel } from '../dominio/papel';

// "876000h" (~100 anos) -- mesmo valor usado no ban nativo do DeliveryHub
// (/admin/usuarios), efetivamente permanente até alguém desbloquear explicitamente.
const DURACAO_BLOQUEIO_PERMANENTE = '876000h';
const DURACAO_SEM_BLOQUEIO = 'none';

@Injectable()
export class ProvedorIdentidadeSupabase implements ProvedorIdentidadePort {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  async criarUsuarioComConvite(email: string): Promise<ResultadoCriarUsuarioComConvite> {
    const { data, error } = await this.supabase.admin.auth.admin.inviteUserByEmail(email);

    if (!error && data.user) {
      return { id: data.user.id, jaExistiaNoProvedor: false };
    }

    const jaExiste =
      error?.code === 'email_exists' || /already.*registered/i.test(error?.message ?? '');
    if (!jaExiste) {
      throw new InternalServerErrorException(`Falha ao convidar usuário: ${error?.message}`);
    }

    // E-mail já existe no provedor -- recupera o id sem reenviar convite. `generateLink`
    // nunca envia e-mail, só devolve o link/usuário (mesma chamada usada em
    // gerarLinkAcesso), então é seguro usar aqui só como consulta.
    const { data: linkData, error: linkError } = await this.supabase.admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });
    if (linkError || !linkData?.user) {
      throw new InternalServerErrorException(
        `E-mail já cadastrado no provedor, mas falha ao recuperar o id: ${linkError?.message}`,
      );
    }

    return { id: linkData.user.id, jaExistiaNoProvedor: true };
  }

  async gerarLinkAcesso(email: string): Promise<string> {
    // Primeira origem de APP_ALLOWED_ORIGINS -- único frontend desta API (ver CORS em
    // main.ts). Sem isso, o Supabase usa o `site_url` do projeto (pode nem apontar pro
    // domínio certo em produção) como destino do link.
    const origemFrontend = this.config
      .getOrThrow<string>('APP_ALLOWED_ORIGINS')
      .split(',')[0]
      .trim();

    const { data, error } = await this.supabase.admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${origemFrontend}/definir-senha` },
    });

    if (error || !data?.properties?.action_link) {
      throw new InternalServerErrorException(`Falha ao gerar link de acesso: ${error?.message}`);
    }

    return data.properties.action_link;
  }

  async sincronizarClaims(id: string, claims: ClaimsIdentidade): Promise<void> {
    const { error } = await this.supabase.admin.auth.admin.updateUserById(id, {
      app_metadata: {
        papel: claims.papel,
        escopo: claims.escopo,
        nunca_restringe: claims.nuncaRestringe,
        contador_id: claims.contadorId,
        empresa_id: claims.empresaId,
      },
    });

    if (error) {
      throw new InternalServerErrorException(`Falha ao sincronizar claims: ${error.message}`);
    }
  }

  async atualizarEmail(id: string, novoEmail: string): Promise<void> {
    const { error } = await this.supabase.admin.auth.admin.updateUserById(id, {
      email: novoEmail,
      email_confirm: true,
    });
    if (error) {
      const jaExiste = error.code === 'email_exists' || /already.*registered/i.test(error.message ?? '');
      if (jaExiste) {
        throw new InternalServerErrorException('E-mail já está em uso por outra identidade no provedor');
      }
      throw new InternalServerErrorException(`Falha ao atualizar e-mail: ${error.message}`);
    }
  }

  async atualizarSenha(id: string, novaSenha: string): Promise<void> {
    const { error } = await this.supabase.admin.auth.admin.updateUserById(id, {
      password: novaSenha,
    });
    if (error) {
      const senhaFraca = error.code === 'weak_password' || /password should be at least/i.test(error.message ?? '');
      if (senhaFraca) {
        throw new BadRequestException('Senha muito curta -- o provedor exige pelo menos 9 caracteres');
      }
      throw new InternalServerErrorException(`Falha ao atualizar senha: ${error.message}`);
    }
  }

  async bloquearAcesso(id: string): Promise<void> {
    const { error } = await this.supabase.admin.auth.admin.updateUserById(id, {
      ban_duration: DURACAO_BLOQUEIO_PERMANENTE,
    });
    if (error) {
      throw new InternalServerErrorException(`Falha ao bloquear acesso: ${error.message}`);
    }
  }

  async desbloquearAcesso(id: string): Promise<void> {
    const { error } = await this.supabase.admin.auth.admin.updateUserById(id, {
      ban_duration: DURACAO_SEM_BLOQUEIO,
    });
    if (error) {
      throw new InternalServerErrorException(`Falha ao desbloquear acesso: ${error.message}`);
    }
  }

  async revogarSessoes(id: string): Promise<void> {
    // NOTA: `@supabase/supabase-js` não expõe um método de conveniência pra "logout
    // global por id de usuário" (o `auth.admin.signOut` da SDK opera sobre um JWT
    // específico, não um id) -- chamando o endpoint GoTrue direto. Verificar contra a
    // versão do Supabase em uso antes de depender disso em produção (endpoint pode
    // mudar entre versões do GoTrue).
    const resposta = await fetch(
      `${this.config.getOrThrow<string>('SUPABASE_URL')}/auth/v1/admin/users/${id}/logout`,
      {
        method: 'POST',
        headers: {
          apikey: this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
          Authorization: `Bearer ${this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
      },
    );

    if (!resposta.ok) {
      throw new InternalServerErrorException(
        `Falha ao revogar sessões (status ${resposta.status}): ${await resposta.text()}`,
      );
    }
  }

  async validarToken(token: string): Promise<IdentidadeValidada> {
    const { data, error } = await this.supabase.client.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    const metadata = data.user.app_metadata as {
      papel?: Papel;
      escopo?: EscopoPapel;
      nunca_restringe?: boolean;
      contador_id?: string | null;
      empresa_id?: string | null;
    };

    if (!metadata.papel || !metadata.escopo) {
      // Usuário existe no Auth mas nunca teve claims sincronizados (ex: convite aceito
      // mas CriarUsuarioUseCase falhou no meio) -- não deixar passar sem papel definido,
      // nenhuma policy de RLS reconheceria esse usuário como pertencente a nada.
      throw new UnauthorizedException('Usuário sem papel definido -- contate o suporte');
    }

    return {
      id: data.user.id,
      papel: metadata.papel,
      escopo: metadata.escopo,
      nuncaRestringe: metadata.nunca_restringe ?? false,
      contadorId: metadata.contador_id ?? null,
      empresaId: metadata.empresa_id ?? null,
    };
  }
}
