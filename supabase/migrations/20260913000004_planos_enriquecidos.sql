-- Enriquece o catálogo de planos de créditos SERPRO (admin→contador) com descrição,
-- módulos anunciados, data de validade e flag de "grátis" -- mesma riqueza de campos de
-- pacotes_modulos, mas é uma entidade de negócio DIFERENTE (créditos de consulta, não
-- acesso a módulo de funcionalidade).
alter table planos
  add column descricao text null,
  add column modulos text[] not null default '{}',
  add column data_validade date null,
  add column gratuito boolean not null default false;

alter table planos
  add constraint planos_gratuito_preco_check check (gratuito or preco > 0);

comment on column planos.modulos is 'Vitrine informativa (o que o plano anuncia incluir) -- NÃO altera empresa_tem_modulo()/empresa_modulos_liberados(), que continuam resolvendo módulo liberado só via licencas_modulo/pacotes_modulos. Um plano de créditos é por contador, sem granularidade de empresa -- ligar módulo aqui criaria um segundo caminho concorrente de liberação (ex: contador assina 1 plano barato e libera módulo de graça pra toda a carteira). Decisão registrada no plano abundant-swinging-teacup.md.';
comment on column planos.data_validade is 'Null = sem expiração. Só bloqueia novo checkout de assinatura (ver iniciar-checkout-assinatura.usecase.ts) -- assinatura já ativa não é cancelada automaticamente.';
comment on column planos.gratuito is 'Quando true, preco pode ser 0 -- ver constraint planos_gratuito_preco_check.';
