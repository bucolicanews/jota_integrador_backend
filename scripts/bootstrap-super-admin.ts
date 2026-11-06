import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CriarUsuarioUseCase } from '../src/auth/aplicacao/casos-de-uso/criar-usuario.usecase';
import { Papel } from '../src/auth/dominio/papel';
import { SupabaseService } from '../src/common/supabase/supabase.service';

/**
 * Bootstrap do primeiro SUPER_ADMIN -- só passo manual que sobra numa instalação nova
 * (usuarios.id tem FK real pra auth.users, não dá pra seedar via migration SQL pura, ver
 * comentário em supabase/migrations/20260912000002_licenciamento_modulos.sql). Idempotente:
 * se já existe qualquer SUPER_ADMIN, não cria outro -- plataforma já tem dono, rodar de
 * novo por engano (CI, redeploy) não deve gerar um segundo admin.
 *
 * Uso: BOOTSTRAP_ADMIN_NOME="..." BOOTSTRAP_ADMIN_EMAIL="..." npm run bootstrap:admin
 */
async function bootstrap(): Promise<void> {
  const nome = process.env.BOOTSTRAP_ADMIN_NOME;
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  if (!nome || !email) {
    console.error('Defina BOOTSTRAP_ADMIN_NOME e BOOTSTRAP_ADMIN_EMAIL antes de rodar.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const supabase = app.get(SupabaseService);

    const { data: papelSuperAdmin, error: erroPapel } = await supabase.admin
      .from('papeis')
      .select('id')
      .eq('nome', Papel.SUPER_ADMIN)
      .single();
    if (erroPapel || !papelSuperAdmin) {
      throw new Error(`Papel SUPER_ADMIN não encontrado na tabela papeis: ${erroPapel?.message}`);
    }

    const { count, error: erroContagem } = await supabase.admin
      .from('usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('papel_id', papelSuperAdmin.id);
    if (erroContagem) throw new Error(`Falha ao checar SUPER_ADMIN existente: ${erroContagem.message}`);
    if ((count ?? 0) > 0) {
      console.log(`Já existe ${count} SUPER_ADMIN cadastrado -- nada a fazer.`);
      return;
    }

    const criarUsuario = app.get(CriarUsuarioUseCase);
    const resultado = await criarUsuario.executar({ nome, email, papel: Papel.SUPER_ADMIN, contadorId: null, empresaId: null });

    console.log(`SUPER_ADMIN criado: ${resultado.email} (id ${resultado.id})`);
    console.log(`Link de acesso: ${resultado.linkAcesso}`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((erro) => {
  console.error('Falha no bootstrap do SUPER_ADMIN:', erro.message ?? erro);
  process.exit(1);
});
