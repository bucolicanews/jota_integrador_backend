-- Config PagBank: conta/sandbox/kill-switch da plataforma (singleton,
-- configuracoes_plataforma) + conta de cada contador pra receber split
-- (cadastro 100% manual, sem OAuth -- mesmo padrão do projeto irmão DeliveryHub).
alter table configuracoes_plataforma
  add column pagbank_account_id text,
  add column pagbank_sandbox boolean not null default true,
  add column pagbank_split_habilitado boolean not null default true;

comment on column configuracoes_plataforma.pagbank_split_habilitado is 'Kill-switch: nasce ligado (split já confirmado funcionando em produção no projeto irmão) -- SUPER_ADMIN/ADMIN_FINANCEIRO desliga sem apagar pagbank_account_id se a PagBank bloquear split pra conta da plataforma (whitelist). Token da plataforma (PAGBANK_PLATFORM_TOKEN) fica só em .env, nunca aqui -- mesmo tratamento de credencial sensível que STRIPE_SECRET_KEY já recebe.';

alter table contadores add column pagbank_account_id text;

comment on column contadores.pagbank_account_id is 'ID da conta do contador na PagBank, colado manualmente por ele (sem OAuth/onboarding automatizado) -- necessário pra receber a parte dele no split de pagamento de ativação de pacote.';
