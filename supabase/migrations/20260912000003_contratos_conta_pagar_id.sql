-- contratos_gerados já rastreava conta_receber_id (caso original: empresa fatura o
-- próprio cliente). Agora que um contrato pode ter uma EMPRESA como contraparte
-- (licenciamento de módulo, contador cobrando a própria empresa-cliente), o financeiro
-- gera os DOIS lados (emitir_cobranca_interna) -- falta rastrear também o lado pagar.
alter table contratos_gerados add column conta_pagar_id uuid references contas_pagar(id);

comment on column contratos_gerados.conta_pagar_id is 'Preenchido só quando empresa_contraparte_id está preenchido (emitir_cobranca_interna gera os dois lados). Null no caso original de contrato com cliente (só conta_receber_id).';
