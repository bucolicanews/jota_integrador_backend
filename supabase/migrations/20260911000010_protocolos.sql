-- Módulo Protocolos: rastreamento de entrega de documento físico entre o escritório
-- contábil e o cliente (ex: entregar uma via impressa de um relatório/contrato), com
-- prova de entrega. Minerado (só leitura) de jotaCaixa/src/{pages/Protocolos.tsx,
-- hooks/use-protocolos.ts, components/protocolos/*, types/protocolo.ts} -- descoberta
-- nova, não estava em nenhuma fase do roadmap original.
--
-- Máquina de estados: criado -> impresso -> transito -> entregue (feliz), com
-- cancelado/problema acessíveis a partir de qualquer estado não-terminal. Valores em
-- minúsculo sem acento (mesmo critério de todo enum de status já usado no projeto --
-- 'aberta'/'parcial'/'paga', 'pendente'/'conciliada' etc.), o frontend traduz pro rótulo
-- acentuado.
--
-- Desvio deliberado do jotaCaixa: lá o upload de anexo/foto de entrega vai direto do
-- browser pro Supabase Storage, bucket público. Aqui o bucket é privado e todo
-- upload/leitura passa pelo backend NestJS (signed URL sob demanda) -- mesmo padrão já
-- usado em mensagens_caixa_postal (20260909000003_caixa_postal_isn_e_bucket.sql).

create table protocolos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  cliente_id uuid not null references clientes(id),
  numero_protocolo text not null,
  titulo text not null,
  descricao text,
  link_tarefa text,
  status text not null default 'criado'
    check (status in ('criado', 'impresso', 'transito', 'entregue', 'cancelado', 'problema')),
  nome_resp_recebimento text,
  img_protocolo_ref text, -- storage ref (path no bucket), nunca URL pública
  observacao_status text, -- motivo do cancelado/problema -- obrigatório nessas transições, validado na aplicação
  data_criacao timestamptz not null default now(),
  data_impressao timestamptz,
  data_recebimento timestamptz,
  criado_por uuid not null,
  usuario_criador_nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index idx_protocolos_empresa_numero on protocolos(empresa_id, numero_protocolo);
create index idx_protocolos_empresa on protocolos(empresa_id);
create index idx_protocolos_cliente on protocolos(cliente_id);

create trigger trg_protocolos_atualizado_em before update on protocolos
  for each row execute function set_atualizado_em();

comment on table protocolos is 'Rastreamento de entrega de documento físico contador->cliente, com prova de entrega (foto + responsável). Nunca excluído fora de criado/impresso -- ver policy protocolos_delete.';
comment on column protocolos.img_protocolo_ref is 'Path no bucket privado protocolos-anexos, não URL pública -- leitura só via signed URL gerada pelo backend após checar RBAC.';

create table protocolos_anexos (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references protocolos(id) on delete cascade,
  nome_arquivo text not null,
  storage_ref text not null,
  criado_em timestamptz not null default now()
);

create index idx_protocolos_anexos_protocolo on protocolos_anexos(protocolo_id);

comment on table protocolos_anexos is 'Anexos enviados na criação do protocolo (documentos de apoio) -- distinto de img_protocolo_ref (foto do protocolo assinado, capturada só na entrega).';

alter table protocolos enable row level security;
alter table protocolos_anexos enable row level security;

create policy protocolos_select on protocolos for select to authenticated
  using (pode_acessar_empresa(empresa_id));

create policy protocolos_insert on protocolos for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

create policy protocolos_update on protocolos for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

-- Excluir só quando status in ('criado','impresso') -- mesma regra da aplicação, reforçada
-- aqui como defesa em profundidade (RLS não deixa nem tentar via SQL direto).
create policy protocolos_delete on protocolos for delete to authenticated
  using (
    (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
    and status in ('criado', 'impresso')
  );

create policy protocolos_anexos_select on protocolos_anexos for select to authenticated
  using (exists (select 1 from protocolos p where p.id = protocolo_id and pode_acessar_empresa(p.empresa_id)));

create policy protocolos_anexos_insert on protocolos_anexos for insert to authenticated
  with check (
    exists (
      select 1 from protocolos p
      where p.id = protocolo_id
        and (eh_plataforma() or auth_contador_id() = (select contador_id from empresas e where e.id = p.empresa_id))
    )
  );

-- Bucket privado -- upload/leitura só via backend (service_role), nunca direto do browser.
insert into storage.buckets (id, name, public)
values ('protocolos-anexos', 'protocolos-anexos', false)
on conflict (id) do nothing;

insert into permissoes (recurso, acao) values
  ('protocolos', 'visualizar'), ('protocolos', 'criar'), ('protocolos', 'editar'), ('protocolos', 'excluir')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('OPERADOR_CONTADOR', 'OPERADOR_EMPRESA')
  and perm.recurso = 'protocolos'
on conflict do nothing;
