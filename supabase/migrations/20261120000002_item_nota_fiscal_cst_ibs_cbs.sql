-- CST-IBS/CBS (3 dígitos, imposto/IBSCBS/CST) -- par obrigatório do c_class_trib no mesmo
-- Grupo UB, exigido pelo calculador RTC Regime Regular (ItemOperacaoInput.cst). Faltou na
-- migration anterior (20261120000001) por ter sido descoberto só agora, ao integrar o
-- segundo calculador. Aditivo, mesmo princípio das demais colunas RTC.

alter table notas_fiscais_itens add column cst_ibs_cbs text;

comment on column notas_fiscais_itens.cst_ibs_cbs is 'imposto/IBSCBS/CST (Grupo UB, 3 dígitos) -- Código de Situação Tributária do IBS/CBS, par obrigatório do c_class_trib pro calculador RTC Regime Regular. Nunca confundir com cst_csosn/cst_pis/cst_cofins (grupos diferentes).';

create or replace function criar_nota_fiscal_com_itens(
  p_empresa_id uuid,
  p_chave_acesso text,
  p_modelo text,
  p_direcao text,
  p_numero text,
  p_serie text,
  p_data_emissao timestamptz,
  p_c_stat integer,
  p_emitente_cnpj text,
  p_emitente_nome text,
  p_destinatario_documento text,
  p_destinatario_nome text,
  p_valor_total numeric,
  p_fornecedor_id uuid,
  p_cliente_id uuid,
  p_xml_storage_ref text,
  p_xml_bruto jsonb,
  p_itens jsonb,
  p_parcelas jsonb,
  p_pagamentos jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nota_id uuid;
  v_item jsonb;
  v_parcela jsonb;
  v_pagamento jsonb;
begin
  insert into notas_fiscais (
    empresa_id, chave_acesso, modelo, direcao, numero, serie, data_emissao, c_stat,
    emitente_cnpj, emitente_nome, destinatario_documento, destinatario_nome, valor_total,
    fornecedor_id, cliente_id, xml_storage_ref, xml_bruto
  ) values (
    p_empresa_id, p_chave_acesso, p_modelo, p_direcao::direcao_nota_fiscal, p_numero, p_serie, p_data_emissao, p_c_stat,
    p_emitente_cnpj, p_emitente_nome, p_destinatario_documento, p_destinatario_nome, p_valor_total,
    p_fornecedor_id, p_cliente_id, p_xml_storage_ref, p_xml_bruto
  )
  returning id into v_nota_id;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    insert into notas_fiscais_itens (
      nota_fiscal_id, empresa_id, numero_item, codigo_produto, descricao, ncm, cest, cfop,
      quantidade, valor_unitario, valor_total, cst_csosn, valor_icms, valor_icms_st,
      valor_pis, cst_pis, valor_cofins, cst_cofins, valor_cbs, valor_ibs,
      c_class_trib, c_ativ_sn, p_ibs_sn, p_cbs_sn, cst_ibs_cbs, imposto_bruto
    ) values (
      v_nota_id, p_empresa_id,
      (v_item ->> 'numero_item')::integer,
      v_item ->> 'codigo_produto',
      v_item ->> 'descricao',
      v_item ->> 'ncm',
      v_item ->> 'cest',
      v_item ->> 'cfop',
      (v_item ->> 'quantidade')::numeric,
      (v_item ->> 'valor_unitario')::numeric,
      (v_item ->> 'valor_total')::numeric,
      v_item ->> 'cst_csosn',
      (v_item ->> 'valor_icms')::numeric,
      (v_item ->> 'valor_icms_st')::numeric,
      (v_item ->> 'valor_pis')::numeric,
      v_item ->> 'cst_pis',
      (v_item ->> 'valor_cofins')::numeric,
      v_item ->> 'cst_cofins',
      (v_item ->> 'valor_cbs')::numeric,
      (v_item ->> 'valor_ibs')::numeric,
      v_item ->> 'c_class_trib',
      v_item ->> 'c_ativ_sn',
      v_item ->> 'p_ibs_sn',
      v_item ->> 'p_cbs_sn',
      v_item ->> 'cst_ibs_cbs',
      v_item -> 'imposto_bruto'
    );
  end loop;

  for v_parcela in select * from jsonb_array_elements(p_parcelas)
  loop
    insert into notas_fiscais_parcelas (nota_fiscal_id, empresa_id, numero_duplicata, data_vencimento, valor)
    values (
      v_nota_id, p_empresa_id,
      v_parcela ->> 'numero_duplicata',
      (v_parcela ->> 'data_vencimento')::date,
      (v_parcela ->> 'valor')::numeric
    );
  end loop;

  for v_pagamento in select * from jsonb_array_elements(p_pagamentos)
  loop
    insert into notas_fiscais_pagamentos (nota_fiscal_id, empresa_id, indicador_pagamento, forma_pagamento, valor)
    values (
      v_nota_id, p_empresa_id,
      v_pagamento ->> 'indicador_pagamento',
      v_pagamento ->> 'forma_pagamento',
      (v_pagamento ->> 'valor')::numeric
    );
  end loop;

  return v_nota_id;
end;
$$;

comment on function criar_nota_fiscal_com_itens(uuid, text, text, text, text, text, timestamptz, integer, text, text, text, text, numeric, uuid, uuid, text, jsonb, jsonb, jsonb, jsonb) is 'Única forma de criar uma nota fiscal capturada -- cabeçalho + itens (com cst_pis/cst_cofins/campos RTC Simples Nacional/Regime Regular) + parcelas + pagamentos numa transação só, nunca cabeçalho órfão sem item.';
