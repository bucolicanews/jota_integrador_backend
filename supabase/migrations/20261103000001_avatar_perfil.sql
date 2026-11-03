-- Foto de perfil do usuário -- guarda só a referência (path no bucket), igual ao padrão
-- já usado em contratos-selfies/das-pdfs: nunca URL pública direta, sempre resolvida via
-- signed URL no backend (docs/ARQUITETURA.md: frontend nunca fala direto com Storage).
alter table usuarios add column avatar_ref text;

comment on column usuarios.avatar_ref is 'Path no bucket avatares-perfil (ex: "<usuario_id>/avatar.jpg"). Resolvido pra signed URL em ObterPerfilUseCase/AtualizarAvatarProprioUseCase, nunca exposto crú.';

-- Bucket privado -- mesmo raciocínio de certificados-privados: sem NENHUMA storage policy
-- pra authenticated/anon, só a service role (sempre via backend) lê/escreve aqui.
insert into storage.buckets (id, name, public)
values ('avatares-perfil', 'avatares-perfil', false)
on conflict (id) do nothing;
