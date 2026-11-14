-- Declaração (Programa Gerador do Documento de Arrecadação do Simples Nacional --
-- Declaratório) -- terceiro documento distinto do Extrato (CONSEXTRATO16) e do Recibo
-- de Entrega da Apuração no PGDAS-D (ambos já existentes). Vem da MESMA chamada
-- CONSDECREC15 que já busca o recibo (nome do serviço = "Consultar DEClaração e
-- RECibo") -- ver extrairDeclaracaoERecibo em SincronizarDasEmpresaUseCase. NUNCA
-- CONFIRMADO contra o SERPRO real.
alter table declaracoes_pgdas
  add column declaracao_storage_ref text;

comment on column declaracoes_pgdas.declaracao_storage_ref is 'PDF da Declaração (Programa Gerador do DAS -- Declaratório), mesma chamada CONSDECREC15 do recibo_storage_ref -- cacheado no sync, nunca muda depois de transmitida.';
