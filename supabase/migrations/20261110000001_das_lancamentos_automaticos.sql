-- DAS: provisão automática (como conta a pagar) + pendência de baixa -- pedido do
-- usuário (sessão 2026-11-10/11). Toda vez que a sincronização detectar um DAS "a
-- vencer" ou "vencido" sem provisão ainda, gera 1 CONTA A PAGAR automática (fornecedor é
-- texto livre, ex: "Receita Federal", sem precisar cadastro) via CriarContaPagarUseCase
-- -- esse usecase já cria a conta+parcela+lançamento junto (Débito despesa / Crédito
-- passivo "DAS a pagar", contas escolhidas em das_configuracoes_lancamentos), idempotente
-- via conta_pagar_provisao_id. Quando o DAS vira "pago", a baixa NÃO é automática --
-- exige escolher caixa ou banco (qual conta bancária, se foi banco o lançamento fica
-- pendente de conciliação de verdade), então vira pendência resolvida manualmente, nunca
-- dentro do próprio sync -- esse lado continua lançamento direto por enquanto (unificar
-- com o pagamento de contas_a_pagar é um passo futuro, não feito nesta migration).

alter table lancamentos_contabeis drop constraint lancamentos_contabeis_origem_check;
alter table lancamentos_contabeis add constraint lancamentos_contabeis_origem_check
  check (origem in ('manual', 'contas_a_pagar', 'contas_a_receber', 'contrato', 'conciliacao_bancaria', 'das', 'estorno'));

-- Só tem sentido quando origem = 'das' e a baixa foi feita contra um banco (não caixa) --
-- a conciliação bancária atual casa transação do extrato com PARCELA de conta a
-- pagar/receber, nunca com lançamento direto; este flag é o primeiro caso de "lançamento
-- direto pendente de ser casado com o extrato real" do projeto.
alter table lancamentos_contabeis add column pendente_conciliacao boolean not null default false;
comment on column lancamentos_contabeis.pendente_conciliacao is 'true = lançamento de baixa (origem=das, via banco) ainda não casado com o extrato real.';

alter table das_mei add column conta_pagar_provisao_id uuid references contas_pagar(id);
alter table das_mei add column lancamento_baixa_id uuid references lancamentos_contabeis(id);
alter table declaracoes_pgdas add column conta_pagar_provisao_id uuid references contas_pagar(id);
alter table declaracoes_pgdas add column lancamento_baixa_id uuid references lancamentos_contabeis(id);

comment on column das_mei.conta_pagar_provisao_id is 'Conta a pagar de provisão já gerada pra este DAS (idempotência -- nunca gera 2x). NULL = ainda não gerada (sem config, ou sync ainda não processou).';
comment on column das_mei.lancamento_baixa_id is 'Lançamento de baixa (quitação) já gerado pra este DAS. NULL + status=pago = pendência aguardando o contador escolher caixa/banco.';
comment on column declaracoes_pgdas.conta_pagar_provisao_id is 'Conta a pagar de provisão já gerada pra este DAS (idempotência -- nunca gera 2x). NULL = ainda não gerada (sem config, ou sync ainda não processou).';
comment on column declaracoes_pgdas.lancamento_baixa_id is 'Lançamento de baixa (quitação) já gerado pra este DAS. NULL + status=pago = pendência aguardando o contador escolher caixa/banco.';

create table das_configuracoes_lancamentos (
  empresa_id uuid primary key references empresas(id),
  conta_debito_id uuid not null references plano_contas(id),
  conta_credito_id uuid not null references plano_contas(id),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid not null references usuarios(id)
);

comment on table das_configuracoes_lancamentos is 'Par de contas (débito despesa / crédito passivo) usado pela provisão automática de DAS -- uma linha por empresa. Sem linha = sync continua normal, só não gera lançamento (não bloqueia).';

-- Mesmo padrão de lancamentos_contabeis/das_mei/declaracoes_pgdas -- tabela só acessada
-- pelo backend via client admin (service role), nunca direto do frontend.
alter table das_configuracoes_lancamentos enable row level security;
create policy das_configuracoes_lancamentos_deny on das_configuracoes_lancamentos for all using (false) with check (false);
