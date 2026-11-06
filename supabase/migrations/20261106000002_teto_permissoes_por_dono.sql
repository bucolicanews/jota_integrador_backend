-- Teto de permissões POR DONO (contador/empresa/plataforma) -- sobrescreve o teto global
-- (papel_permissoes) só pro próprio dono quando configurado; sem override, continua
-- valendo o global de sempre (nada muda pra quem nunca configurar isso). "dono" é
-- exatamente um de: plataforma (contador_id/empresa_id ambos null), um contador, ou uma
-- empresa -- nunca os dois ids juntos (mesmo padrão de usuarios.chk_escopo_papel_vinculo).
create table papel_permissoes_dono (
  id uuid primary key default gen_random_uuid(),
  papel_id uuid not null references papeis(id) on delete cascade,
  contador_id uuid references contadores(id) on delete cascade,
  empresa_id uuid references empresas(id) on delete cascade,
  permissao_id uuid not null references permissoes(id) on delete cascade,
  criado_em timestamptz not null default now(),
  constraint chk_papel_permissoes_dono_escopo check (not (contador_id is not null and empresa_id is not null)),
  unique (papel_id, contador_id, empresa_id, permissao_id)
);

comment on table papel_permissoes_dono is 'Override por dono do teto de permissões de um papel -- contador configura só pro OPERADOR_CONTADOR da própria carteira, empresa só pro OPERADOR_EMPRESA dela, plataforma (contador_id/empresa_id ambos null) pro ADMIN_FINANCEIRO/ADMIN_SUPORTE. Sem nenhuma linha pra um (papel,dono), cai no teto global de papel_permissoes.';

create index idx_papel_permissoes_dono_contador on papel_permissoes_dono(papel_id, contador_id) where contador_id is not null;
create index idx_papel_permissoes_dono_empresa on papel_permissoes_dono(papel_id, empresa_id) where empresa_id is not null;
create index idx_papel_permissoes_dono_plataforma on papel_permissoes_dono(papel_id) where contador_id is null and empresa_id is null;

alter table papel_permissoes_dono enable row level security;

-- Leitura: mesma política de papel_permissoes -- catálogo de teto não é dado sensível,
-- enforcement real de posse é no backend (admin client) + nas políticas de escrita abaixo.
create policy papel_permissoes_dono_select on papel_permissoes_dono
  for select to authenticated using (true);

-- Escrita: só quem tem autoridade sobre aquele dono específico -- plataforma edita
-- qualquer linha, um contador só edita linha do próprio contador_id, uma empresa só da
-- própria empresa_id. Nunca editar linha de outro dono, nem o escopo plataforma sem ser
-- plataforma.
create policy papel_permissoes_dono_insert on papel_permissoes_dono
  for insert to authenticated
  with check (
    eh_plataforma()
    or (contador_id is not null and contador_id = auth_contador_id())
    or (empresa_id is not null and empresa_id = auth_empresa_id())
  );

create policy papel_permissoes_dono_delete on papel_permissoes_dono
  for delete to authenticated
  using (
    eh_plataforma()
    or (contador_id is not null and contador_id = auth_contador_id())
    or (empresa_id is not null and empresa_id = auth_empresa_id())
  );
