-- NFCe paga no ato (dinheiro/cartão/PIX etc) nunca tinha o grupo pag/detPag capturado --
-- só cobr/dup (duplicata/parcelamento, que NFCe de balcão normalmente não tem). Resultado:
-- toda venda à vista virava conta a receber "Aberta" pra sempre, mesmo já recebida na hora.
-- Esta migration guarda o pagamento real da nota e, quando é 100% dinheiro à vista, baixa
-- automático na aprovação (AprovarNotaFiscalUseCase) -- cartão/PIX/transferência continuam
-- "Aberta" de propósito, pra serem conciliados depois via extrato bancário (módulo
-- conciliacao-bancaria já existente faz o casamento transação↔parcela sozinho).

create table notas_fiscais_pagamentos (
  id uuid primary key default gen_random_uuid(),
  nota_fiscal_id uuid not null references notas_fiscais(id) on delete cascade,
  empresa_id uuid not null references empresas(id),
  -- indPag: '0' à vista, '1' a prazo, '2' outros (layout 4.00+). Null em XML muito antigo
  -- sem o campo -- nunca bloqueia a ingestão por isso, mesmo princípio de parcelas vazio.
  indicador_pagamento text,
  -- tPag bruto (01 Dinheiro, 03/04 Cartão Crédito/Débito, 17 PIX, 18 Transferência, etc) --
  -- nunca normalizado, mesmo padrão de cst_csosn em notas_fiscais_itens.
  forma_pagamento text not null,
  valor numeric(14,2) not null
);

create index idx_nf_pagamentos_nota on notas_fiscais_pagamentos(nota_fiscal_id);

comment on table notas_fiscais_pagamentos is 'Espelha pag/detPag do XML -- usado por AprovarNotaFiscalUseCase pra decidir baixa automática (só dinheiro 100% à vista) e exibido no detalhe da nota (forma de pagamento + se já foi pago).';

alter table notas_fiscais_pagamentos enable row level security;
create policy notas_fiscais_pagamentos_select on notas_fiscais_pagamentos for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy notas_fiscais_pagamentos_insert on notas_fiscais_pagamentos for insert to authenticated with check (eh_plataforma());
create policy notas_fiscais_pagamentos_update on notas_fiscais_pagamentos for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy notas_fiscais_pagamentos_delete on notas_fiscais_pagamentos for delete to authenticated using (false);

drop function if exists criar_nota_fiscal_com_itens(uuid, text, text, text, text, text, timestamptz, integer, text, text, text, text, numeric, uuid, uuid, text, jsonb, jsonb, jsonb);

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
      valor_pis, valor_cofins, valor_cbs, valor_ibs, imposto_bruto
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
      (v_item ->> 'valor_cofins')::numeric,
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

comment on function criar_nota_fiscal_com_itens(uuid, text, text, text, text, text, timestamptz, integer, text, text, text, text, numeric, uuid, uuid, text, jsonb, jsonb, jsonb, jsonb) is 'Única forma de criar uma nota fiscal capturada -- cabeçalho + itens + parcelas + pagamentos numa transação só, nunca cabeçalho órfão sem item.';

alter table configuracoes_lancamentos_notas_fiscais
  add column conta_recebimento_vista_id uuid references plano_contas(id);

comment on column configuracoes_lancamentos_notas_fiscais.conta_recebimento_vista_id is 'Conta Caixa/Banco usada pra baixar automático a conta a receber de NFCe 100% paga em dinheiro à vista (tPag=01, indPag=0) -- null (padrão) desativa a baixa automática, fica "Aberta" pra baixa manual como antes. Nunca usada pra cartão/PIX/transferência -- esses ficam abertos de propósito pra conciliação bancária (módulo conciliacao-bancaria) casar com o extrato real.';
