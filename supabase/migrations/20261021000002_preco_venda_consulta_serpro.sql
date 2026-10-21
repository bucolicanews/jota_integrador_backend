-- Preço de venda por tipo de consulta (idSistema) -- distinto do custo interno
-- (custo_reais, já existente) que é só margem/acompanhamento operacional da Jota.
-- Admin pode cadastrar custo e preço de venda em momentos diferentes, por isso nullable.
alter table custos_consultas_serpro
  add column preco_venda_reais numeric(10, 2) check (preco_venda_reais >= 0);

comment on column custos_consultas_serpro.preco_venda_reais is 'Preço cobrado do cliente final por consulta bem-sucedida desse id_sistema (fora da cota incluída no plano) -- distinto de custo_reais, que é o custo interno pago ao SERPRO.';
