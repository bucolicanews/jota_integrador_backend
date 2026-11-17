-- Importação do S-1200 (eSocial) -> lançamento contábil automático da folha (débito despesa
-- salários/pró-labore, crédito passivo INSS/a pagar) -- mesmo padrão de
-- configuracoes_lancamentos_notas_fiscais (par fixo de contas por empresa, escolhidas pelo
-- contador, nunca inferidas na importação).

alter table lancamentos_contabeis drop constraint lancamentos_contabeis_origem_check;
alter table lancamentos_contabeis add constraint lancamentos_contabeis_origem_check
  check (origem in ('manual', 'contas_a_pagar', 'contas_a_receber', 'contrato', 'conciliacao_bancaria', 'das', 'notas_fiscais', 'esocial', 'estorno'));

create table configuracoes_lancamentos_esocial (
  empresa_id uuid primary key references empresas(id),
  conta_despesa_salario_id uuid not null references plano_contas(id),
  conta_despesa_pro_labore_id uuid not null references plano_contas(id),
  -- INSS vira Conta a Pagar própria (débito despesa dedicada, não some dentro do salário) --
  -- escolha explícita do contador: trade-off aceito de computar a despesa de INSS em cima
  -- do mesmo valor que já compõe o bruto de salário/pró-labore, em troca de ter
  -- vencimento/parcela rastreado igual qualquer outro título (ver sessão 2026-11-16).
  conta_despesa_inss_id uuid not null references plano_contas(id),
  conta_passivo_inss_id uuid not null references plano_contas(id),
  -- Separado: salário e pró-labore debitam em despesas diferentes, então creditam em
  -- passivos "a pagar" diferentes também -- nunca mistura o que a empresa deve aos
  -- funcionários com o que deve aos sócios.
  conta_passivo_salario_a_pagar_id uuid not null references plano_contas(id),
  conta_passivo_pro_labore_a_pagar_id uuid not null references plano_contas(id),
  -- Encargo FGTS é opcional na v1 -- usecase pula essa partida sem erro se não configurado.
  conta_despesa_fgts_id uuid references plano_contas(id),
  conta_passivo_fgts_id uuid references plano_contas(id),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid not null references usuarios(id)
);

comment on table configuracoes_lancamentos_esocial is 'Contas escolhidas pelo contador pra o lançamento automático gerado ao importar S-1200 -- mesmo padrão de configuracoes_lancamentos_notas_fiscais.';

alter table configuracoes_lancamentos_esocial enable row level security;
create policy configuracoes_lancamentos_esocial_deny on configuracoes_lancamentos_esocial for all using (false) with check (false);

insert into permissoes (recurso, acao) values
  ('esocial', 'visualizar'), ('esocial', 'editar')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('OPERADOR_CONTADOR', 'OPERADOR_EMPRESA')
  and perm.recurso = 'esocial'
on conflict do nothing;
