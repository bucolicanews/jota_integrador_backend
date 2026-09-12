-- Fase 2 do port do jotaCaixa: Contas a Pagar / Contas a Receber, minerado (só leitura)
-- de ContasPagar.tsx/ContasReceber.tsx e das tabelas admin_contas_pagar/contas_pagar,
-- admin_parcelas_pagar/parcelas_contas_pagar, admin_pagamentos/pagamentos,
-- admin_contas_receber/contas_receber, admin_parcelas_receber/parcelas_contas_receber,
-- admin_recebimentos/recebimentos.
--
-- Correções deliberadas em relação ao jotaCaixa (mesma disciplina de sempre -- ver
-- migrations 20260909000005 e 20260911000001/2):
--
-- 1. SEM duplicação Admin/Cliente (jotaCaixa tinha uma tabela `admin_x` e uma `x` pra
--    cada entidade, escolhida em runtime por `ownerType`). Aqui só existe o nível
--    empresa (mesmo padrão de plano_contas/lancamentos_contabeis) -- a contabilidade da
--    própria firma (o que era "Admin" no jotaCaixa) já é coberta de outra forma no
--    jota_integrador (módulo honorarios, Stripe Connect), não precisa duplicar aqui.
--
-- 2. Pagamento/recebimento SEMPRE passa por `criar_lancamento_contabil` (já existe) --
--    nunca insert solto. O relatório de mineração encontrou EXATAMENTE a classe de bug
--    já corrigida na conciliação (múltiplos INSERTs não-atômicos: pagamento registrado
--    sem lançamento correspondente, sinal débito/crédito trocado 3 vezes em scripts de
--    correção manual, `INSTRUCOES_RESTAURACAO.md` documentando um incidente real de
--    reconciliação de balanço). Reusar a função atômica já fecha essa classe inteira.
--
-- 3. status/valor pago da parcela NUNCA armazenado -- sempre derivado somando
--    `pagamentos_contas_pagar`/`recebimentos_contas_receber` não estornados (mesmo
--    princípio de `saldo_conta_contabil`, nunca cacheado). Só o que é ação explícita
--    (cancelar) vira coluna.
--
-- 4. Estorno de pagamento cria o lançamento INVERSO via `estornar_lancamento_contabil`
--    (já existe) -- o jotaCaixa (`EditarParcelaPagaDialog`) deletava e recriava
--    lançamentos na hora de "ajustar" um recebimento já pago, destruindo o rastro.
--
-- 5. `fornecedor` (contas_pagar) continua texto livre, IGUAL ao jotaCaixa -- nunca teve
--    FK lá, não é atalho meu. `cliente_nome` (contas_receber) também fica texto livre
--    POR ENQUANTO (decisão explícita, não esquecimento) -- o jotaCaixa tinha FK real
--    pra `tbl_clientes`, mas a tabela de clientes ainda não existe no jota_integrador
--    (é a Fase 3 do roadmap). Migration futura troca por `cliente_id` quando a Fase 3
--    entregar o módulo de clientes.

-- ============================================================
-- Contas a Pagar
-- ============================================================

create table contas_pagar (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  fornecedor text not null,
  descricao text not null,
  valor_total numeric(14, 2) not null check (valor_total > 0),
  data_emissao date not null default current_date,
  -- Passivo (a pagar) e Despesa (o que está sendo pago) -- mesmo par usado no
  -- lançamento de cada pagamento, guardado aqui pra pré-preencher o formulário.
  conta_patrimonial_id uuid not null references plano_contas(id),
  conta_resultado_id uuid not null references plano_contas(id),
  cancelada boolean not null default false,
  criado_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_contas_pagar_empresa on contas_pagar(empresa_id);

create trigger trg_contas_pagar_atualizado_em before update on contas_pagar
  for each row execute function set_atualizado_em();

create table parcelas_contas_pagar (
  id uuid primary key default gen_random_uuid(),
  conta_pagar_id uuid not null references contas_pagar(id),
  empresa_id uuid not null references empresas(id), -- denormalizado, evita join só pra filtrar/RLS
  numero_parcela integer not null,
  valor_parcela numeric(14, 2) not null check (valor_parcela > 0),
  data_vencimento date not null,
  cancelada boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (conta_pagar_id, numero_parcela)
);

create index idx_parcelas_contas_pagar_conta on parcelas_contas_pagar(conta_pagar_id);
create index idx_parcelas_contas_pagar_empresa on parcelas_contas_pagar(empresa_id);

-- Cada pagamento é seu próprio lançamento contábil real -- várias linhas aqui pra uma
-- parcela suportam pagamento parcial em mais de uma vez (mesmo caso de uso do
-- RegistrarPagamentoCPDialog do jotaCaixa, sem a fragilidade da versão de lá).
create table pagamentos_contas_pagar (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null references parcelas_contas_pagar(id),
  empresa_id uuid not null references empresas(id),
  conta_bancaria_id uuid not null references plano_contas(id),
  valor_pago numeric(14, 2) not null check (valor_pago > 0),
  data_pagamento date not null,
  lancamento_id uuid not null references lancamentos_contabeis(id),
  estornado boolean not null default false,
  criado_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now()
);

create index idx_pagamentos_cp_parcela on pagamentos_contas_pagar(parcela_id);
create index idx_pagamentos_cp_empresa on pagamentos_contas_pagar(empresa_id);

alter table contas_pagar enable row level security;
alter table parcelas_contas_pagar enable row level security;
alter table pagamentos_contas_pagar enable row level security;

create policy contas_pagar_select on contas_pagar for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy contas_pagar_insert on contas_pagar for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy contas_pagar_update on contas_pagar for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy contas_pagar_delete on contas_pagar for delete to authenticated using (false);

create policy parcelas_contas_pagar_select on parcelas_contas_pagar for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy parcelas_contas_pagar_insert on parcelas_contas_pagar for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy parcelas_contas_pagar_update on parcelas_contas_pagar for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy parcelas_contas_pagar_delete on parcelas_contas_pagar for delete to authenticated using (false);

create policy pagamentos_cp_select on pagamentos_contas_pagar for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy pagamentos_cp_insert on pagamentos_contas_pagar for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
-- Estorno é a única forma de "desfazer" -- update só pra marcar estornado, nunca apaga.
create policy pagamentos_cp_update on pagamentos_contas_pagar for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy pagamentos_cp_delete on pagamentos_contas_pagar for delete to authenticated using (false);

comment on table contas_pagar is 'Cabeçalho de uma obrigação a pagar (pode ter 1 ou várias parcelas). status/valor pago são sempre derivados de pagamentos_contas_pagar, nunca armazenados.';
comment on table pagamentos_contas_pagar is 'Cada pagamento real de uma parcela, sempre com um lancamento_id correspondente (criado via criar_lancamento_contabil). Nunca apagado -- estornar cria o lançamento inverso e marca estornado=true.';

-- ============================================================
-- Contas a Receber (espelha Contas a Pagar)
-- ============================================================

create table contas_receber (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  cliente_nome text not null,
  descricao text not null,
  valor_total numeric(14, 2) not null check (valor_total > 0),
  data_emissao date not null default current_date,
  -- Ativo (a receber) e Receita (o que está sendo recebido).
  conta_patrimonial_id uuid not null references plano_contas(id),
  conta_resultado_id uuid not null references plano_contas(id),
  cancelada boolean not null default false,
  criado_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_contas_receber_empresa on contas_receber(empresa_id);

create trigger trg_contas_receber_atualizado_em before update on contas_receber
  for each row execute function set_atualizado_em();

create table parcelas_contas_receber (
  id uuid primary key default gen_random_uuid(),
  conta_receber_id uuid not null references contas_receber(id),
  empresa_id uuid not null references empresas(id),
  numero_parcela integer not null,
  valor_parcela numeric(14, 2) not null check (valor_parcela > 0),
  data_vencimento date not null,
  cancelada boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (conta_receber_id, numero_parcela)
);

create index idx_parcelas_contas_receber_conta on parcelas_contas_receber(conta_receber_id);
create index idx_parcelas_contas_receber_empresa on parcelas_contas_receber(empresa_id);

create table recebimentos_contas_receber (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null references parcelas_contas_receber(id),
  empresa_id uuid not null references empresas(id),
  conta_bancaria_id uuid not null references plano_contas(id),
  valor_recebido numeric(14, 2) not null check (valor_recebido > 0),
  data_recebimento date not null,
  lancamento_id uuid not null references lancamentos_contabeis(id),
  estornado boolean not null default false,
  criado_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now()
);

create index idx_recebimentos_cr_parcela on recebimentos_contas_receber(parcela_id);
create index idx_recebimentos_cr_empresa on recebimentos_contas_receber(empresa_id);

alter table contas_receber enable row level security;
alter table parcelas_contas_receber enable row level security;
alter table recebimentos_contas_receber enable row level security;

create policy contas_receber_select on contas_receber for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy contas_receber_insert on contas_receber for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy contas_receber_update on contas_receber for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy contas_receber_delete on contas_receber for delete to authenticated using (false);

create policy parcelas_contas_receber_select on parcelas_contas_receber for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy parcelas_contas_receber_insert on parcelas_contas_receber for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy parcelas_contas_receber_update on parcelas_contas_receber for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy parcelas_contas_receber_delete on parcelas_contas_receber for delete to authenticated using (false);

create policy recebimentos_cr_select on recebimentos_contas_receber for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy recebimentos_cr_insert on recebimentos_contas_receber for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy recebimentos_cr_update on recebimentos_contas_receber for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy recebimentos_cr_delete on recebimentos_contas_receber for delete to authenticated using (false);

comment on table contas_receber is 'Cabeçalho de uma obrigação a receber (pode ter 1 ou várias parcelas). status/valor recebido são sempre derivados de recebimentos_contas_receber, nunca armazenados. cliente_nome é texto livre por ora -- vira FK pra clientes quando a Fase 3 (Clientes/Fornecedores) do roadmap existir.';
comment on table recebimentos_contas_receber is 'Cada recebimento real de uma parcela, sempre com um lancamento_id correspondente. Nunca apagado -- estornar cria o lançamento inverso e marca estornado=true.';

-- ============================================================
-- Catálogo de permissões (mesmo mecanismo ligado na Fase 1 -- conciliacao_bancaria)
-- ============================================================

insert into permissoes (recurso, acao) values
  ('contas_a_pagar', 'visualizar'), ('contas_a_pagar', 'criar'), ('contas_a_pagar', 'editar'), ('contas_a_pagar', 'excluir'),
  ('contas_a_receber', 'visualizar'), ('contas_a_receber', 'criar'), ('contas_a_receber', 'editar'), ('contas_a_receber', 'excluir')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('OPERADOR_CONTADOR', 'OPERADOR_EMPRESA')
  and perm.recurso in ('contas_a_pagar', 'contas_a_receber')
on conflict do nothing;
