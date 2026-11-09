-- Pivô: segundo fator deixa de ser obrigatório só pra papel de plataforma e passa a
-- ser escolha de CADA usuário (Nenhum/TOTP/Email), qualquer papel -- mesma UX do
-- DeliveryHub (two_factor_method), adaptada pro login 100% client->Supabase deste
-- projeto (docs/SEGURANCA.md §8): TOTP usa o MFA nativo do Supabase (sessão carrega
-- `aal`); email é inteiramente nosso (Supabase não tem fator "email" nativo), por isso
-- precisa de tabela própria pra saber se a sessão ATUAL já passou pelo código.

alter table usuarios drop column mfa_habilitado;

alter table usuarios
  add column metodo_2fa text not null default 'nenhum' check (metodo_2fa in ('nenhum', 'totp', 'email')),
  add column email_2fa_codigo_hash text,
  add column email_2fa_codigo_expira_em timestamptz,
  add column email_2fa_tentativas integer not null default 0;

-- Uma linha por sessão (session_id do JWT, estável entre refreshes do mesmo login) que
-- já confirmou o código de email nesta sessão -- SupabaseAuthGuard consulta isto só
-- pra quem escolheu metodo_2fa='email' (TOTP não precisa, usa o `aal` da própria
-- sessão, que o Supabase já garante).
create table sessoes_2fa_email_verificadas (
  session_id text primary key,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  verificado_em timestamptz not null default now(),
  expira_em timestamptz not null
);

create index idx_sessoes_2fa_email_verificadas_usuario on sessoes_2fa_email_verificadas(usuario_id);
