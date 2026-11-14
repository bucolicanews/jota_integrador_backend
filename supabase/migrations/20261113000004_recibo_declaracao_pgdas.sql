-- Recibo de entrega da declaração PGDASD (CONSDECREC15, "Consultar Declaração e
-- Recibo") -- documento diferente do Extrato (CONSEXTRATO16, relatório de apuração) e
-- da 2ª via (GERARDAS12, boleto). NUNCA CONFIRMADO contra o SERPRO real (nem trial nem
-- produção) -- shape inferido só da doc, mesmo cuidado já aplicado a PAGAMENTOS71 (ver
-- comentário de SincronizarDasEmpresaUseCase). numero_declaracao vem de
-- indiceDeclaracao.numeroDeclaracao (CONSDECLARACAO13, pode vir null) -- sem ele não dá
-- pra pedir o recibo de uma declaração específica.
alter table declaracoes_pgdas
  add column numero_declaracao text,
  add column recibo_storage_ref text;

comment on column declaracoes_pgdas.numero_declaracao is 'indiceDeclaracao.numeroDeclaracao (CONSDECLARACAO13) -- capturado no sync pra permitir buscar o recibo sem repetir a consulta de declarações.';
comment on column declaracoes_pgdas.recibo_storage_ref is 'PDF do recibo de entrega da declaração (CONSDECREC15), cacheado no sync -- mesma lógica do Extrato, a declaração transmitida nunca muda depois.';
