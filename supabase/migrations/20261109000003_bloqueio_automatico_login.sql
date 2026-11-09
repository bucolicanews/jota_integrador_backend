-- Lockout automático por senha errada repetida -- login é 100% client->Supabase Auth
-- (docs/SEGURANCA.md §8), então quem detecta "senha errada" é o hook HTTP
-- "Password Verification Attempt" do próprio Supabase (ver src/supabase-hooks/), não o
-- NestJS. Colunas separadas de `bloqueado`/`bloqueado_por` (esse é bloqueio MANUAL de
-- admin, com autor humano) -- lockout automático nunca tem `executadoPorId`.
alter table usuarios
  add column tentativas_login_falhas integer not null default 0,
  add column bloqueio_automatico_ate timestamptz;
