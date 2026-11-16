-- sessoes_2fa_email_verificadas estava sem RLS -- exposta pro anon/authenticated key
-- (achado via advisor do Supabase CLI, 2026-11-13). Único acesso real é
-- Sessoes2faEmailRepositorioSupabase via supabase.admin (service_role, sempre
-- ignora RLS) -- sem policy nenhuma é seguro aqui, nunca bloqueia o backend.
alter table sessoes_2fa_email_verificadas enable row level security;
