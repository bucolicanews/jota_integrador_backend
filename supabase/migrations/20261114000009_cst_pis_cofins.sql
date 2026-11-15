-- Fase 4.5 da apuração do Simples (partilha de tributos) precisa saber se a receita de um
-- item já teve PIS/COFINS recolhido por substituição tributária (CST 05) ou monofásico
-- (CST 04), pra excluir essa parcela do DAS do mês. CST de ICMS já é capturado (cst_csosn);
-- CST de PIS/COFINS nunca foi.

alter table notas_fiscais_itens add column cst_pis text;
alter table notas_fiscais_itens add column cst_cofins text;

comment on column notas_fiscais_itens.cst_pis is 'Bruto como veio no XML -- CST de saída PIS (01-09/49/99). 04=monofásica alíquota zero, 05=substituição tributária. Nunca normalizado.';
comment on column notas_fiscais_itens.cst_cofins is 'Mesmo domínio de códigos do cst_pis, pra COFINS.';

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
  p_parcelas jsonb
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
      valor_pis, cst_pis, valor_cofins, cst_cofins, valor_cbs, valor_ibs, imposto_bruto
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

  return v_nota_id;
end;
$$;
