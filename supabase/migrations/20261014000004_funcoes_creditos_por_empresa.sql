-- Reescreve debitar_creditos/creditar_creditos (20260906000011 + 20260909000002) pra
-- travar/atualizar creditos_saldo por empresa_id em vez de contador_id -- mesma
-- atomicidade (lock de linha + auditoria numa transação só), só muda a chave.
-- p_contador_id continua existindo nos dois só pra gravar em creditos_movimentos
-- (auditoria "quem geriu"), não é mais a chave de creditos_saldo.
create or replace function debitar_creditos(
  p_contador_id uuid,
  p_empresa_id uuid,
  p_tipo_operacao text,
  p_quantidade integer,
  p_motivo text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo_atual integer;
  v_saldo_novo integer;
begin
  if p_quantidade <= 0 then
    raise exception 'Quantidade a debitar deve ser positiva (recebido: %)', p_quantidade;
  end if;
  if p_empresa_id is null then
    raise exception 'Débito de consumo sempre precisa de empresa_id';
  end if;

  -- Lock da linha -- concorrência (duas requisições simultâneas tentando debitar a
  -- mesma empresa) serializa aqui, nunca deixa o saldo ficar inconsistente
  -- (docs/SEGURANCA.md §6: "proteger contra fraude de consumo... race condition").
  select saldo_atual into v_saldo_atual
  from creditos_saldo
  where empresa_id = p_empresa_id
  for update;

  if v_saldo_atual is null then
    raise exception 'Empresa % não possui registro de saldo de créditos (sem plano ativo?)', p_empresa_id;
  end if;
  if v_saldo_atual < p_quantidade then
    raise exception 'Saldo insuficiente: disponível %, necessário %', v_saldo_atual, p_quantidade;
  end if;

  v_saldo_novo := v_saldo_atual - p_quantidade;

  update creditos_saldo set saldo_atual = v_saldo_novo, atualizado_em = now()
  where empresa_id = p_empresa_id;

  insert into creditos_movimentos (contador_id, empresa_id, tipo_operacao, quantidade, saldo_antes, saldo_depois, motivo)
  values (p_contador_id, p_empresa_id, p_tipo_operacao, -p_quantidade, v_saldo_atual, v_saldo_novo, p_motivo);

  return v_saldo_novo;
end;
$$;

create or replace function creditar_creditos(
  p_contador_id uuid,
  p_empresa_id uuid,
  p_quantidade integer,
  p_motivo text,
  p_tipo_operacao text default 'AJUSTE_MANUAL'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo_atual integer;
  v_saldo_novo integer;
begin
  if p_quantidade <= 0 then
    raise exception 'Quantidade a creditar deve ser positiva (recebido: %)', p_quantidade;
  end if;
  if p_empresa_id is null then
    raise exception 'Crédito sempre precisa de empresa_id';
  end if;

  select saldo_atual into v_saldo_atual
  from creditos_saldo
  where empresa_id = p_empresa_id
  for update;

  if v_saldo_atual is null then
    -- Primeira concessão de créditos pra empresa -- cria o registro em vez de exigir
    -- um passo de "provisionar saldo" separado antes da primeira recarga.
    insert into creditos_saldo (empresa_id, saldo_atual) values (p_empresa_id, 0);
    v_saldo_atual := 0;
  end if;

  v_saldo_novo := v_saldo_atual + p_quantidade;

  update creditos_saldo set saldo_atual = v_saldo_novo, atualizado_em = now()
  where empresa_id = p_empresa_id;

  insert into creditos_movimentos (contador_id, empresa_id, tipo_operacao, quantidade, saldo_antes, saldo_depois, motivo)
  values (p_contador_id, p_empresa_id, p_tipo_operacao, p_quantidade, v_saldo_atual, v_saldo_novo, p_motivo);

  return v_saldo_novo;
end;
$$;

-- creditar_creditos mudou de assinatura (ganhou p_empresa_id) -- o create or replace
-- acima criou a nova forma (5 args) como overload; remove a forma antiga (4 args,
-- contador_id só) pra ninguém chamar por engano a versão que não existe mais de verdade.
-- debitar_creditos manteve a mesma assinatura (só o corpo mudou) -- create or replace
-- sozinho já basta, nada a dropar aqui.
drop function if exists creditar_creditos(uuid, integer, text, text);

comment on function debitar_creditos(uuid, uuid, text, integer, text) is 'Débito atômico por EMPRESA (lock + checagem de saldo + auditoria numa transação só). Lança exceção se saldo insuficiente -- nunca deixa ficar negativo. p_contador_id só vai pra auditoria em creditos_movimentos.';
comment on function creditar_creditos(uuid, uuid, integer, text, text) is 'Crédito/ajuste atômico por EMPRESA -- cria o registro de saldo na primeira concessão se ainda não existir. tipo_operacao default AJUSTE_MANUAL; pagamento PIX com split usa RENOVACAO_ASSINATURA.';
