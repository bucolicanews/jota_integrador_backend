-- Enriquece o catálogo de pacotes de módulos (admin→contador) com descrição, data de
-- validade (null = sem expiração) e um flag explícito de "grátis" -- antes só existia
-- implicitamente na ativação (valorCobrado nulo em licencas_modulo), nunca como
-- propriedade do próprio pacote.
alter table pacotes_modulos
  add column descricao text null,
  add column data_validade date null,
  add column gratuito boolean not null default false;

-- Move pro banco a regra que hoje só vive no DTO (@IsPositive() em preco) -- defesa em
-- profundidade: pacote pago precisa de preço > 0, pacote grátis pode ter preço 0.
alter table pacotes_modulos
  add constraint pacotes_modulos_gratuito_preco_check check (gratuito or preco > 0);

comment on column pacotes_modulos.data_validade is 'Null = sem expiração. Só bloqueia NOVAS compras/ativações (ver ativar-licenca.usecase.ts/iniciar-checkout-licenca.usecase.ts) -- licença já ativa continua liberando o módulo mesmo depois do pacote expirar no catálogo, não existe job de revogação automática.';
comment on column pacotes_modulos.gratuito is 'Quando true, preco pode ser 0 -- ver constraint pacotes_modulos_gratuito_preco_check.';
