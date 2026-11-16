-- Tabelas de referência pro futuro sistema de folha de pagamento (INSS/IRRF/FGTS) --
-- globais da plataforma (não por contador/empresa, é legislação federal igual pra todos),
-- com vigência explícita porque mudam todo ano (e às vezes no meio do ano, caso 2026 com a
-- Lei 15.270/2025 criando um redutor extra no IRRF). Nunca hardcoded no código: alíquota
-- nova não pode exigir deploy, só um INSERT (manual ou por import).

create table tabelas_tributarias (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('inss', 'irrf', 'fgts')),
  vigencia_inicio date not null,
  vigencia_fim date, -- null = ainda vigente
  descricao text,
  -- Parâmetros que não são faixa de alíquota -- cada tipo tem o próprio formato:
  -- IRRF: {"isencao_ate": 5000, "redutor_ate": 7350, "redutor_constante": 978.62,
  --        "redutor_coeficiente": 0.133145, "deducao_por_dependente": 189.59,
  --        "desconto_simplificado": 607.20} (Lei 15.270/2025)
  -- FGTS: {"aliquota_percentual": 8.00} (sem faixa, por isso nem usa a tabela de faixas)
  -- INSS: {} (só as faixas bastam)
  parametros jsonb not null default '{}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tipo, vigencia_inicio)
);

create table tabelas_tributarias_faixas (
  id uuid primary key default gen_random_uuid(),
  tabela_id uuid not null references tabelas_tributarias(id) on delete cascade,
  ordem int not null,
  valor_de numeric(12,2) not null,
  valor_ate numeric(12,2), -- null = sem teto (última faixa)
  aliquota_percentual numeric(5,2) not null,
  parcela_deduzir numeric(12,2) not null default 0,
  unique (tabela_id, ordem)
);

alter table tabelas_tributarias enable row level security;
alter table tabelas_tributarias_faixas enable row level security;

-- Leitura liberada pra qualquer autenticado (é legislação pública, todo contador/empresa
-- usa a mesma); escrita só SUPER_ADMIN -- mesma régua de outras tabelas de referência da
-- plataforma (ex: planos). Backend usa service-role pra tudo de qualquer forma; isso é
-- defesa em profundidade, não o gate real.
create policy "tabelas_tributarias_leitura" on tabelas_tributarias for select using (true);
create policy "tabelas_tributarias_escrita_super_admin" on tabelas_tributarias for all using (eh_super_admin()) with check (eh_super_admin());
create policy "tabelas_tributarias_faixas_leitura" on tabelas_tributarias_faixas for select using (true);
create policy "tabelas_tributarias_faixas_escrita_super_admin" on tabelas_tributarias_faixas for all using (eh_super_admin()) with check (eh_super_admin());

-- Seed: tabelas vigentes a partir de 2026-01-01 (pesquisadas em 2026-11-16 -- INSS/IRRF
-- com teto/faixas do ano corrente, IRRF já com o redutor da Lei 15.270/2025 vigente desde
-- jan/2026). Confirmar contra a fonte oficial (Receita Federal/INSS) antes de usar em
-- produção -- isso é um ponto de partida pesquisado, não substitui a publicação oficial.
insert into tabelas_tributarias (tipo, vigencia_inicio, descricao, parametros) values
  ('inss', '2026-01-01', 'Tabela INSS 2026 -- 4 faixas progressivas, teto R$ 8.475,55', '{}'),
  ('irrf', '2026-01-01', 'Tabela IRRF 2026 -- Lei 15.270/2025, isenção até R$ 5.000 + redutor linear até R$ 7.350', '{
    "isencao_ate": 5000.00,
    "redutor_ate": 7350.00,
    "redutor_constante": 978.62,
    "redutor_coeficiente": 0.133145,
    "deducao_por_dependente": 189.59,
    "desconto_simplificado": 607.20
  }'::jsonb),
  ('fgts', '2026-01-01', 'FGTS -- percentual fixo, sem faixa', '{"aliquota_percentual": 8.00}'::jsonb);

insert into tabelas_tributarias_faixas (tabela_id, ordem, valor_de, valor_ate, aliquota_percentual, parcela_deduzir)
select id, 1, 0.00, 1621.00, 7.5, 0.00 from tabelas_tributarias where tipo = 'inss' and vigencia_inicio = '2026-01-01'
union all
select id, 2, 1621.01, 2902.84, 9.0, 24.32 from tabelas_tributarias where tipo = 'inss' and vigencia_inicio = '2026-01-01'
union all
select id, 3, 2902.85, 4354.27, 12.0, 111.40 from tabelas_tributarias where tipo = 'inss' and vigencia_inicio = '2026-01-01'
union all
select id, 4, 4354.28, 8475.55, 14.0, 198.49 from tabelas_tributarias where tipo = 'inss' and vigencia_inicio = '2026-01-01';

insert into tabelas_tributarias_faixas (tabela_id, ordem, valor_de, valor_ate, aliquota_percentual, parcela_deduzir)
select id, 1, 0.00, 2428.80, 0.0, 0.00 from tabelas_tributarias where tipo = 'irrf' and vigencia_inicio = '2026-01-01'
union all
select id, 2, 2428.81, 2826.65, 7.5, 182.16 from tabelas_tributarias where tipo = 'irrf' and vigencia_inicio = '2026-01-01'
union all
select id, 3, 2826.66, 3751.05, 15.0, 394.16 from tabelas_tributarias where tipo = 'irrf' and vigencia_inicio = '2026-01-01'
union all
select id, 4, 3751.06, 4664.68, 22.5, 675.49 from tabelas_tributarias where tipo = 'irrf' and vigencia_inicio = '2026-01-01'
union all
select id, 5, 4664.69, null, 27.5, 908.73 from tabelas_tributarias where tipo = 'irrf' and vigencia_inicio = '2026-01-01';
