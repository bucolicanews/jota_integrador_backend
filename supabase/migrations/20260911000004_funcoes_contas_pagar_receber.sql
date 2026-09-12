-- Criar conta + parcelas precisa ser atômico (mesmo motivo de sempre: um INSERT solto
-- do cabeçalho seguido de outro dos filhos pode deixar cabeçalho órfão sem parcela se o
-- segundo passo falhar). Mesmo padrão de `criar_lancamento_contabil`.

create or replace function criar_conta_pagar_com_parcelas(
  p_empresa_id uuid,
  p_fornecedor text,
  p_descricao text,
  p_conta_patrimonial_id uuid,
  p_conta_resultado_id uuid,
  p_data_emissao date,
  p_criado_por uuid,
  p_parcelas jsonb -- [{"numero_parcela": 1, "valor_parcela": 100.00, "data_vencimento": "2026-10-01"}, ...]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conta_id uuid;
  v_parcela jsonb;
  v_qtd integer;
begin
  v_qtd := jsonb_array_length(p_parcelas);
  if v_qtd < 1 then
    raise exception 'Conta a pagar precisa de ao menos 1 parcela';
  end if;

  insert into contas_pagar (empresa_id, fornecedor, descricao, valor_total, data_emissao, conta_patrimonial_id, conta_resultado_id, criado_por)
  select p_empresa_id, p_fornecedor, p_descricao,
    (select coalesce(sum((p ->> 'valor_parcela')::numeric), 0) from jsonb_array_elements(p_parcelas) as p),
    p_data_emissao, p_conta_patrimonial_id, p_conta_resultado_id, p_criado_por
  returning id into v_conta_id;

  for v_parcela in select * from jsonb_array_elements(p_parcelas)
  loop
    insert into parcelas_contas_pagar (conta_pagar_id, empresa_id, numero_parcela, valor_parcela, data_vencimento)
    values (
      v_conta_id, p_empresa_id,
      (v_parcela ->> 'numero_parcela')::integer,
      (v_parcela ->> 'valor_parcela')::numeric,
      (v_parcela ->> 'data_vencimento')::date
    );
  end loop;

  return v_conta_id;
end;
$$;

comment on function criar_conta_pagar_com_parcelas(uuid, text, text, uuid, uuid, date, uuid, jsonb) is 'Única forma de criar uma conta a pagar -- cabeçalho + parcelas numa transação só, nunca cabeçalho órfão sem parcela.';

create or replace function criar_conta_receber_com_parcelas(
  p_empresa_id uuid,
  p_cliente_nome text,
  p_descricao text,
  p_conta_patrimonial_id uuid,
  p_conta_resultado_id uuid,
  p_data_emissao date,
  p_criado_por uuid,
  p_parcelas jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conta_id uuid;
  v_parcela jsonb;
  v_qtd integer;
begin
  v_qtd := jsonb_array_length(p_parcelas);
  if v_qtd < 1 then
    raise exception 'Conta a receber precisa de ao menos 1 parcela';
  end if;

  insert into contas_receber (empresa_id, cliente_nome, descricao, valor_total, data_emissao, conta_patrimonial_id, conta_resultado_id, criado_por)
  select p_empresa_id, p_cliente_nome, p_descricao,
    (select coalesce(sum((p ->> 'valor_parcela')::numeric), 0) from jsonb_array_elements(p_parcelas) as p),
    p_data_emissao, p_conta_patrimonial_id, p_conta_resultado_id, p_criado_por
  returning id into v_conta_id;

  for v_parcela in select * from jsonb_array_elements(p_parcelas)
  loop
    insert into parcelas_contas_receber (conta_receber_id, empresa_id, numero_parcela, valor_parcela, data_vencimento)
    values (
      v_conta_id, p_empresa_id,
      (v_parcela ->> 'numero_parcela')::integer,
      (v_parcela ->> 'valor_parcela')::numeric,
      (v_parcela ->> 'data_vencimento')::date
    );
  end loop;

  return v_conta_id;
end;
$$;

comment on function criar_conta_receber_com_parcelas(uuid, text, text, uuid, uuid, date, uuid, jsonb) is 'Única forma de criar uma conta a receber -- cabeçalho + parcelas numa transação só, nunca cabeçalho órfão sem parcela.';
