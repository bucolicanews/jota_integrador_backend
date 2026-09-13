-- Módulo de Ponto Eletrônico. Minerado de jotaCaixa/src/{pages/PontoEletronico.tsx,
-- pages/FolhaPonto.tsx, components/ponto/*, components/formularios/GerenciarFaltas.tsx,
-- GerenciarFolgaTrabalhada.tsx, GerenciarFerias(Admin).tsx, hooks/use-ponto-status.ts}.
--
-- jotaCaixa duplica schema por tenant (registros_ponto/admin_registros_ponto,
-- ferias/admin_ferias_user) porque não tem hierarquia de 3 níveis. Aqui vira UMA tabela
-- só com contador_id/empresa_id (exatamente um dos dois -- mesmo padrão de coerência já
-- usado em suporte_tickets). Só papéis OPERADOR_CONTADOR/OPERADOR_EMPRESA batem o
-- próprio ponto (equivalente ao papel "Usuario" do jotaCaixa); donos/plataforma são
-- sempre gestores, nunca batem ponto -- igual jotaCaixa.
--
-- Jornada (salário, horas mensais, folgas fixas) vira tabela própria em vez de colunas
-- soltas em `usuarios` -- separa dado de RH de identidade/auth.

create table ponto_configuracao_funcionario (
  usuario_id uuid primary key references usuarios(id),
  salario numeric(12, 2),
  horas_mensais numeric(6, 2) not null default 220,
  dias_folga_fixos text[] not null default '{}',
  folga_domingo_obrigatoria boolean not null default true,
  data_inicio_contrato date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger trg_ponto_configuracao_atualizado_em before update on ponto_configuracao_funcionario
  for each row execute function set_atualizado_em();

create table ponto_registros (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id), -- o funcionário dono do registro
  contador_id uuid references contadores(id),
  empresa_id uuid references empresas(id),
  tipo text not null check (tipo in ('entrada', 'saida', 'falta', 'abono', 'compensacao', 'extra100')),
  horario_registro timestamptz not null,
  selfie_storage_ref text, -- bucket privado, só entrada/saida não-ajustada
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  ajuste_manual boolean not null default false, -- substitui os sentinelas string 'Ajuste Manual'/'N/A' do jotaCaixa (colunas lá eram NOT NULL)
  minutos_credito integer, -- só falta/abono/compensacao/extra100: minutos creditados nesse dia (jotaCaixa codificava isso como texto livre em `observacao`, ex "Abono=8h" -- aqui é coluna de verdade)
  atestado_storage_ref text,
  observacao text,
  criado_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now(),
  constraint ponto_registros_coerencia_vinculo check (
    (contador_id is not null and empresa_id is null) or (contador_id is null and empresa_id is not null)
  )
);

create index idx_ponto_registros_usuario_horario on ponto_registros(usuario_id, horario_registro);
create index idx_ponto_registros_contador on ponto_registros(contador_id);
create index idx_ponto_registros_empresa on ponto_registros(empresa_id);

comment on column ponto_registros.ajuste_manual is 'true quando o gestor substituiu/editou a batida manualmente -- selfie_storage_ref/latitude/longitude ficam null nesse caso, sem sentinela string.';

create table ponto_ferias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id),
  contador_id uuid references contadores(id),
  empresa_id uuid references empresas(id),
  data_inicio date not null,
  data_fim date not null,
  periodo_referencia text,
  status text not null default 'agendada' check (status in ('agendada', 'concluida', 'cancelada')),
  criado_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now(),
  constraint ponto_ferias_coerencia_vinculo check (
    (contador_id is not null and empresa_id is null) or (contador_id is null and empresa_id is not null)
  )
);

create index idx_ponto_ferias_usuario on ponto_ferias(usuario_id);
create index idx_ponto_ferias_contador on ponto_ferias(contador_id);
create index idx_ponto_ferias_empresa on ponto_ferias(empresa_id);

alter table ponto_configuracao_funcionario enable row level security;
alter table ponto_registros enable row level security;
alter table ponto_ferias enable row level security;

-- Papéis gestores (donos + plataforma) -- funcionário nunca gerencia o próprio ponto,
-- só bate entrada/saída (RegistrarBatida) e lê o que já existe.
-- pode_acessar_empresa() sozinho vazaria registro de um OPERADOR_EMPRESA pro colega
-- (mesmo empresa_id) -- por isso toda policy de gestor checa auth_papel() explicitamente,
-- não só o vínculo.

create policy ponto_configuracao_select on ponto_configuracao_funcionario for select to authenticated
  using (
    usuario_id = auth.uid()
    or (
      auth_papel() in ('SUPER_ADMIN', 'ADMIN_FINANCEIRO', 'ADMIN_SUPORTE', 'CONTADOR_DONO', 'EMPRESARIO_DONO')
      and exists (
        select 1 from usuarios u
        where u.id = ponto_configuracao_funcionario.usuario_id
          and (pode_acessar_contador(u.contador_id) or (u.empresa_id is not null and auth_empresa_id() = u.empresa_id))
      )
    )
  );

create policy ponto_configuracao_insert on ponto_configuracao_funcionario for insert to authenticated
  with check (
    auth_papel() in ('SUPER_ADMIN', 'CONTADOR_DONO', 'EMPRESARIO_DONO')
    and exists (
      select 1 from usuarios u
      where u.id = ponto_configuracao_funcionario.usuario_id
        and (pode_acessar_contador(u.contador_id) or (u.empresa_id is not null and auth_empresa_id() = u.empresa_id))
    )
  );

create policy ponto_configuracao_update on ponto_configuracao_funcionario for update to authenticated
  using (
    auth_papel() in ('SUPER_ADMIN', 'CONTADOR_DONO', 'EMPRESARIO_DONO')
    and exists (
      select 1 from usuarios u
      where u.id = ponto_configuracao_funcionario.usuario_id
        and (pode_acessar_contador(u.contador_id) or (u.empresa_id is not null and auth_empresa_id() = u.empresa_id))
    )
  )
  with check (
    auth_papel() in ('SUPER_ADMIN', 'CONTADOR_DONO', 'EMPRESARIO_DONO')
    and exists (
      select 1 from usuarios u
      where u.id = ponto_configuracao_funcionario.usuario_id
        and (pode_acessar_contador(u.contador_id) or (u.empresa_id is not null and auth_empresa_id() = u.empresa_id))
    )
  );

create policy ponto_registros_select on ponto_registros for select to authenticated
  using (
    usuario_id = auth.uid()
    or (
      auth_papel() in ('SUPER_ADMIN', 'ADMIN_FINANCEIRO', 'ADMIN_SUPORTE', 'CONTADOR_DONO', 'EMPRESARIO_DONO')
      and (pode_acessar_contador(contador_id) or (empresa_id is not null and auth_empresa_id() = empresa_id))
    )
  );

create policy ponto_registros_insert on ponto_registros for insert to authenticated
  with check (
    criado_por = auth.uid()
    and (
      -- o próprio funcionário batendo entrada/saída
      (usuario_id = auth.uid() and tipo in ('entrada', 'saida') and ajuste_manual = false)
      or
      -- gestor lançando/ajustando em nome de um funcionário da própria carteira/empresa
      (
        auth_papel() in ('SUPER_ADMIN', 'CONTADOR_DONO', 'EMPRESARIO_DONO')
        and (pode_acessar_contador(contador_id) or (empresa_id is not null and auth_empresa_id() = empresa_id))
      )
    )
  );

create policy ponto_registros_delete on ponto_registros for delete to authenticated
  using (
    auth_papel() in ('SUPER_ADMIN', 'CONTADOR_DONO', 'EMPRESARIO_DONO')
    and (pode_acessar_contador(contador_id) or (empresa_id is not null and auth_empresa_id() = empresa_id))
  );

create policy ponto_ferias_select on ponto_ferias for select to authenticated
  using (
    usuario_id = auth.uid()
    or (
      auth_papel() in ('SUPER_ADMIN', 'ADMIN_FINANCEIRO', 'ADMIN_SUPORTE', 'CONTADOR_DONO', 'EMPRESARIO_DONO')
      and (pode_acessar_contador(contador_id) or (empresa_id is not null and auth_empresa_id() = empresa_id))
    )
  );

create policy ponto_ferias_insert on ponto_ferias for insert to authenticated
  with check (
    criado_por = auth.uid()
    and auth_papel() in ('SUPER_ADMIN', 'CONTADOR_DONO', 'EMPRESARIO_DONO')
    and (pode_acessar_contador(contador_id) or (empresa_id is not null and auth_empresa_id() = empresa_id))
  );

create policy ponto_ferias_delete on ponto_ferias for delete to authenticated
  using (
    auth_papel() in ('SUPER_ADMIN', 'CONTADOR_DONO', 'EMPRESARIO_DONO')
    and (pode_acessar_contador(contador_id) or (empresa_id is not null and auth_empresa_id() = empresa_id))
  );

-- Buckets privados -- upload/leitura só via backend (service_role), nunca direto do browser.
insert into storage.buckets (id, name, public)
values ('ponto-selfies', 'ponto-selfies', false), ('ponto-atestados', 'ponto-atestados', false)
on conflict (id) do nothing;

insert into permissoes (recurso, acao) values
  ('ponto_eletronico', 'visualizar'), ('ponto_eletronico', 'criar'), ('ponto_eletronico', 'editar'), ('ponto_eletronico', 'excluir')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('OPERADOR_CONTADOR', 'OPERADOR_EMPRESA')
  and perm.recurso = 'ponto_eletronico'
on conflict do nothing;
