-- Permite editar um lançamento já postado (cabeçalho + partidas), decisão explícita do
-- usuário mesmo sabendo que isso reabre o cenário que causou o incidente de saldo no
-- jotaCaixa (editar lançamento direto, sem passar pela validação de partida dobrada).
-- Mitigação: única porta de escrita é esta função SECURITY DEFINER, que roda a MESMA
-- validação de criar_lancamento_contabil (débito=crédito, contas analíticas ativas da
-- mesma empresa) antes de substituir as partidas -- nunca um UPDATE/INSERT direto de
-- `authenticated` (RLS de lancamentos_contabeis/lancamentos_partidas continua `using (false)`
-- pra essas tabelas, só esta função bypassa). Bloqueia editar lançamento já estornado ou
-- que É um estorno -- esses dois já têm seu próprio par imutável, editar quebraria o rastro.

alter table lancamentos_contabeis
  add column atualizado_em timestamptz,
  add column atualizado_por uuid references usuarios(id),
  add column editado boolean not null default false;

comment on column lancamentos_contabeis.editado is 'true = já foi editado ao menos uma vez via atualizar_lancamento_contabil (edição direta, fora do fluxo normal de estorno).';

create or replace function atualizar_lancamento_contabil(
  p_lancamento_id uuid,
  p_data_competencia date,
  p_historico text,
  p_partidas jsonb, -- [{"conta_id": "...", "tipo": "debito"|"credito", "valor": 123.45}, ...]
  p_editado_por uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original record;
  v_total_debito numeric(14, 2);
  v_total_credito numeric(14, 2);
  v_qtd_partidas integer;
  v_contas_invalidas integer;
  v_partida jsonb;
begin
  select * into v_original from lancamentos_contabeis where id = p_lancamento_id;
  if v_original is null then
    raise exception 'Lançamento % não encontrado', p_lancamento_id;
  end if;
  if v_original.estornado then
    raise exception 'Lançamento já foi estornado -- não é possível editar, lance um ajuste novo';
  end if;
  if v_original.origem = 'estorno' then
    raise exception 'Lançamento de estorno não pode ser editado -- ele é o par imutável de outro lançamento';
  end if;

  v_qtd_partidas := jsonb_array_length(p_partidas);
  if v_qtd_partidas < 2 then
    raise exception 'Lançamento precisa de ao menos 2 partidas (recebido: %)', v_qtd_partidas;
  end if;

  select
    coalesce(sum((p ->> 'valor')::numeric) filter (where p ->> 'tipo' = 'debito'), 0),
    coalesce(sum((p ->> 'valor')::numeric) filter (where p ->> 'tipo' = 'credito'), 0)
  into v_total_debito, v_total_credito
  from jsonb_array_elements(p_partidas) as p;

  if v_total_debito <> v_total_credito then
    raise exception 'Lançamento não fecha: débito % <> crédito %', v_total_debito, v_total_credito;
  end if;
  if v_total_debito <= 0 then
    raise exception 'Valor total do lançamento precisa ser maior que zero';
  end if;

  select count(*) into v_contas_invalidas
  from jsonb_array_elements(p_partidas) as p
  left join plano_contas pc on pc.id = (p ->> 'conta_id')::uuid
    and pc.empresa_id = v_original.empresa_id and pc.ativa and not pc.sintetica
  where pc.id is null;

  if v_contas_invalidas > 0 then
    raise exception 'Uma ou mais contas da partida são inválidas (não existem, não são desta empresa, estão inativas ou são sintéticas)';
  end if;

  delete from lancamentos_partidas where lancamento_id = p_lancamento_id;

  for v_partida in select * from jsonb_array_elements(p_partidas)
  loop
    insert into lancamentos_partidas (lancamento_id, conta_id, tipo, valor)
    values (p_lancamento_id, (v_partida ->> 'conta_id')::uuid, v_partida ->> 'tipo', (v_partida ->> 'valor')::numeric);
  end loop;

  update lancamentos_contabeis
  set data_competencia = p_data_competencia,
      historico = p_historico,
      editado = true,
      atualizado_em = now(),
      atualizado_por = p_editado_por
  where id = p_lancamento_id;
end;
$$;

comment on function atualizar_lancamento_contabil(uuid, date, text, jsonb, uuid) is 'Edita cabeçalho+partidas de um lançamento já postado, com a mesma validação de partida dobrada de criar_lancamento_contabil. Bloqueia lançamento estornado ou que é estorno de outro.';
