-- Módulo de Suporte (tickets). Minerado de jotaCaixa/src/{pages/AdminSuporte.tsx,
-- pages/Suporte.tsx, components/suporte/*} -- mas o jotaCaixa é flat (Cliente<->Admin, 1
-- nível). Aqui o destino é fixo pela hierarquia de 3 níveis (confirmado com o usuário):
--   Empresa  -> sempre pro próprio contador (destinatario_tipo='contador')
--   Contador -> sempre pra plataforma/Jota (destinatario_tipo='plataforma')
-- Sem escalonamento de verdade: quando um assunto técnico de empresa precisa da Jota, o
-- contador abre um ticket NOVO pra plataforma que referencia (ticket_referencia_id) o
-- ticket original da empresa -- nunca move/reatribui o ticket existente.
--
-- Desvios deliberados do jotaCaixa (documentados aqui pra não se perderem):
--  1) "Vez de responder" por LADO (solicitante/destinatario), não por usuário -- lá é
--     1:1 (um Cliente, um Admin); aqui cada lado pode ter vários operadores
--     (OPERADOR_CONTADOR/OPERADOR_EMPRESA/ADMIN_SUPORTE). Ver mensagens.remetente_lado.
--  2) Bucket privado + signed URL sob demanda (mesmo padrão de protocolos-anexos),
--     não bucket público como o jotaCaixa.
--  3) Não é módulo licenciável (pacotes_modulos) -- gated só por RBAC/permissoes, igual
--     ao núcleo contábil (Lançamentos, CP/CR etc. nunca são gated por licença).

create table suporte_tickets (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  status text not null default 'aberto'
    check (status in ('aberto', 'em_progresso', 'pausado', 'fechado')),
  prioridade text not null default 'media'
    check (prioridade in ('baixa', 'media', 'alta')),
  destinatario_tipo text not null check (destinatario_tipo in ('contador', 'plataforma')),
  contador_id uuid not null references contadores(id),
  empresa_id uuid references empresas(id), -- só presente quando aberto por uma empresa
  ticket_referencia_id uuid references suporte_tickets(id) on delete set null, -- contador referenciando um ticket de empresa ao falar com a Jota; é só contexto, excluir o ticket referenciado nunca pode travar a exclusão do ticket que o cita
  criado_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint suporte_tickets_coerencia_destino check (
    (destinatario_tipo = 'contador' and empresa_id is not null)
    or (destinatario_tipo = 'plataforma' and empresa_id is null)
  )
);

create index idx_suporte_tickets_contador on suporte_tickets(contador_id);
create index idx_suporte_tickets_empresa on suporte_tickets(empresa_id);
create index idx_suporte_tickets_destinatario on suporte_tickets(destinatario_tipo, status);

create trigger trg_suporte_tickets_atualizado_em before update on suporte_tickets
  for each row execute function set_atualizado_em();

comment on table suporte_tickets is 'Ticket de suporte com destino fixo pela hierarquia: empresa->próprio contador, contador->plataforma. ticket_referencia_id é só contexto (contador citando um ticket de empresa ao falar com a Jota), nunca escalonamento/reatribuição.';
comment on column suporte_tickets.contador_id is 'Sempre presente: o contador responsável (seja o remetente, seja o contador da empresa remetente) -- é o campo usado pra posse em ambos os destinos.';

create table suporte_mensagens (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references suporte_tickets(id) on delete cascade,
  remetente_id uuid not null references usuarios(id),
  remetente_lado text not null check (remetente_lado in ('solicitante', 'destinatario')),
  conteudo text not null,
  anexo_nome text,
  anexo_storage_ref text, -- path no bucket privado suporte-anexos, nunca URL pública
  criado_em timestamptz not null default now()
);

create index idx_suporte_mensagens_ticket on suporte_mensagens(ticket_id, criado_em);

comment on column suporte_mensagens.remetente_lado is 'solicitante = quem abriu o ticket (empresa ou contador); destinatario = quem recebe (contador ou plataforma). A "vez de responder" é sempre do lado oposto ao da última mensagem -- calculado na aplicação, não armazenado no ticket.';
comment on column suporte_mensagens.anexo_storage_ref is 'Path no bucket privado suporte-anexos, não URL pública -- leitura só via signed URL gerada pelo backend após checar RBAC.';

alter table suporte_tickets enable row level security;
alter table suporte_mensagens enable row level security;

create policy suporte_tickets_select on suporte_tickets for select to authenticated
  using (pode_acessar_contador(contador_id) or (empresa_id is not null and auth_empresa_id() = empresa_id));

-- Quem abre é sempre a própria parte (empresa abrindo em nome dela mesma, contador em
-- nome do próprio escritório) -- nunca em nome de outro. Papel de plataforma não cria
-- ticket (só responde), reforçado aqui como defesa em profundidade.
create policy suporte_tickets_insert on suporte_tickets for insert to authenticated
  with check (
    criado_por = auth.uid()
    and (
      (
        destinatario_tipo = 'contador'
        and empresa_id is not null
        and auth_empresa_id() = empresa_id
        and contador_id = (select contador_id from empresas where id = empresa_id)
      )
      or (
        destinatario_tipo = 'plataforma'
        and empresa_id is null
        and auth_contador_id() = contador_id
      )
    )
  );

-- Mudar status/prioridade: qualquer lado que enxerga o ticket pode tentar -- a
-- aplicação restringe prioridade só ao lado destinatário (não duplicado aqui, mesmo
-- padrão de protocolos_update, que também não reforça toda regra de aplicação em RLS).
create policy suporte_tickets_update on suporte_tickets for update to authenticated
  using (pode_acessar_contador(contador_id) or (empresa_id is not null and auth_empresa_id() = empresa_id))
  with check (pode_acessar_contador(contador_id) or (empresa_id is not null and auth_empresa_id() = empresa_id));

create policy suporte_tickets_delete on suporte_tickets for delete to authenticated
  using (pode_acessar_contador(contador_id) or (empresa_id is not null and auth_empresa_id() = empresa_id));

create policy suporte_mensagens_select on suporte_mensagens for select to authenticated
  using (
    exists (
      select 1 from suporte_tickets t
      where t.id = ticket_id
        and (pode_acessar_contador(t.contador_id) or (t.empresa_id is not null and auth_empresa_id() = t.empresa_id))
    )
  );

create policy suporte_mensagens_insert on suporte_mensagens for insert to authenticated
  with check (
    remetente_id = auth.uid()
    and exists (
      select 1 from suporte_tickets t
      where t.id = ticket_id
        and t.status <> 'fechado'
        and (pode_acessar_contador(t.contador_id) or (t.empresa_id is not null and auth_empresa_id() = t.empresa_id))
    )
  );

-- Bucket privado -- upload/leitura só via backend (service_role), nunca direto do browser.
insert into storage.buckets (id, name, public)
values ('suporte-anexos', 'suporte-anexos', false)
on conflict (id) do nothing;

-- Catálogo de ações é um enum fixo do banco (permissoes_acao_check: visualizar/criar/
-- editar/excluir/bloquear) -- 'editar' cobre tanto responder (status/mensagem) quanto
-- mudar prioridade (a restrição "só o lado destinatário muda prioridade" é checada na
-- aplicação, não modelada como verbo próprio aqui, mesmo padrão de protocolos:editar
-- cobrindo várias sub-ações).
insert into permissoes (recurso, acao) values
  ('suporte', 'visualizar'), ('suporte', 'criar'), ('suporte', 'editar'), ('suporte', 'excluir')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('OPERADOR_CONTADOR', 'OPERADOR_EMPRESA')
  and perm.recurso = 'suporte'
on conflict do nothing;
