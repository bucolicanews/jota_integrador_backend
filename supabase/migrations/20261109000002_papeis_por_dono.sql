-- Fase 2 do papel customizável (ver 20261108000002): agora CONTADOR_DONO cria papel pros
-- próprios funcionários (escopo contador) e EMPRESARIO_DONO cria papel pros próprios
-- (escopo empresa), não só SUPER_ADMIN (escopo plataforma, sempre global). `contador_id`/
-- `empresa_id` null/null = papel global (os 7 de sistema + qualquer customizado-global
-- criado por SUPER_ADMIN) -- comportamento idêntico ao de antes desta migration.
--
-- `papeis.nome` deixa de ser único GLOBAL -- dois contadores diferentes podem ter um
-- papel "Atendente" cada, sem colidir. Fica único dentro do mesmo dono (ou global).

alter table papeis add column contador_id uuid references contadores(id) on delete cascade;
alter table papeis add column empresa_id uuid references empresas(id) on delete cascade;

alter table papeis add constraint chk_papeis_dono check (not (contador_id is not null and empresa_id is not null));

alter table papeis drop constraint papeis_nome_key;

create unique index papeis_nome_global_uq on papeis(nome) where contador_id is null and empresa_id is null;
create unique index papeis_nome_contador_uq on papeis(nome, contador_id) where contador_id is not null;
create unique index papeis_nome_empresa_uq on papeis(nome, empresa_id) where empresa_id is not null;

comment on column papeis.contador_id is 'Dono do papel customizado (CONTADOR_DONO criou pra própria equipe) -- null = global (sistema ou customizado-global de SUPER_ADMIN). Nunca preenchido junto com empresa_id.';
comment on column papeis.empresa_id is 'Dono do papel customizado (EMPRESARIO_DONO criou pra própria equipe) -- null = global. Nunca preenchido junto com contador_id.';
comment on table papeis is 'Catálogo de papéis (RBAC) -- os 7 de sistema (sistema=true) são fixos e globais; SUPER_ADMIN cria customizado global; CONTADOR_DONO/EMPRESARIO_DONO criam customizado privado da própria carteira/empresa (contador_id/empresa_id). Nome único só dentro do mesmo dono (ou entre os globais).';
