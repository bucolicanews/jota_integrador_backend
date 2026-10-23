-- 2ª via real do DAS (boleto com código de barras, serviço GERARDAS12 do PGDASD) --
-- distinta do "Extrato do Simples Nacional" (CONSEXTRATO16, já salvo em
-- pdf_storage_ref) -- confirmado contra produção em 2026-10-21 que são documentos
-- diferentes: o Extrato é um relatório de apuração, não o boleto pagável.
-- Gerada sob demanda (não no sync automático, pra não gastar crédito à toa) -- por isso
-- fica null até o usuário clicar "2ª via" pela primeira vez.
alter table declaracoes_pgdas
  add column pdf_segunda_via_storage_ref text;

comment on column declaracoes_pgdas.pdf_segunda_via_storage_ref is 'PDF do boleto real (GERARDAS12), gerado sob demanda -- sempre regenerado no clique (o valor de juros/multa muda com o tempo se vencido), por isso não é cacheado como o Extrato.';
