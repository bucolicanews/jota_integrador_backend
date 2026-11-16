-- Fator R (base pra decidir Anexo III vs V em serviço) = folha de pagamento dos últimos 12
-- meses ÷ RBT12. Mesmo padrão exato de conta_caixa_banco/conta_a_receber/conta_a_pagar
-- (ver 20260909000005_plano_contas_e_lancamentos.sql:33-35) -- o contador marca quais
-- contas de despesa (salários, encargos, pró-labore) entram nessa soma. Nunca marcado na
-- criação/importação do plano (as contas-modelo não sabem de antemão quais contas o
-- contador vai de fato usar pra folha) -- só via "editar conta" depois.
alter table plano_contas add column conta_folha_pagamento boolean not null default false;

comment on column plano_contas.conta_folha_pagamento is 'true = esta conta entra na soma de "folha de pagamento" do Fator R (CalcularFatorRUseCase). Marcado manualmente pelo contador, nunca na criação/importação do plano.';
