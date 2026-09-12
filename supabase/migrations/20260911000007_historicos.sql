-- Fase 4 do port do jotaCaixa: Lançamentos manual. O formulário de lançamento já
-- existe (src/lancamentos-contabeis/, tela contabil-empresa-lancamentos já cobre o
-- que jotaCaixa faz em Lancamentos.tsx, inclusive com N partidas -- mais flexível
-- que o par débito/crédito fixo do jotaCaixa). O que faltava era só o picklist de
-- históricos (GerenciarHistoricos.tsx): frases prontas pra sugerir no campo
-- "histórico" do lançamento, sem repetir digitação. Diferente de clientes/fornecedores,
-- aqui não vira FK -- o campo histórico do lançamento continua texto livre (mantém
-- flexibilidade), o histórico cadastrado só preenche a sugestão na UI.
--
-- GerenciarDescricoesExtrato.tsx/GerenciarIdentificadoresExtrato.tsx (citados no plano
-- original como "apoio pra lançamento manual") na verdade pertencem à Conciliação
-- Bancária, não a Lançamentos (usados só em useConciliacao/useConciliacaoLogic/
-- FormExtratoDireto no jotaCaixa) -- remapeados pra uma fase futura de conciliação
-- direta/manual, não fazem parte desta migration.

create table historicos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  codigo text,
  descricao text not null,
  criado_em timestamptz not null default now()
);

create index idx_historicos_empresa on historicos(empresa_id);

alter table historicos enable row level security;

create policy historicos_select on historicos for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy historicos_insert on historicos for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy historicos_update on historicos for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
-- Delete de verdade aqui é seguro (histórico nunca é FK de lançamento, só sugestão de texto).
create policy historicos_delete on historicos for delete to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

comment on table historicos is 'Picklist de frases prontas pra sugerir no campo histórico do lançamento manual. Não é FK -- lançamento continua texto livre.';

insert into permissoes (recurso, acao) values
  ('historicos', 'visualizar'), ('historicos', 'criar'), ('historicos', 'editar'), ('historicos', 'excluir')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('OPERADOR_CONTADOR', 'OPERADOR_EMPRESA')
  and perm.recurso = 'historicos'
on conflict do nothing;
