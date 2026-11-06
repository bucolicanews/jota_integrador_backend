-- Empresa sem o módulo "bancos" liberado não tem como cadastrar um banco formal (toda a
-- tabela `bancos` é gated por @ExigirModulo('bancos')) -- mas precisa de ALGUM destino de
-- recebimento pra fechar o ciclo contábil quando um link de pagamento com split confirma
-- (ProcessarWebhookPagbankParcelaUseCase). `conta_contabil_pagbank_id` é a alternativa:
-- aponta direto pra uma conta do Plano de Contas (núcleo, sem módulo), sem precisar de um
-- registro em `bancos`. Mutuamente exclusivo com `banco_pagbank_id` (aplicação zera um ao
-- setar o outro -- AtualizarPagbankContaEmpresaUseCase -- e o trigger abaixo reforça isso).

alter table empresas
  add column conta_contabil_pagbank_id uuid references plano_contas(id);

comment on column empresas.conta_contabil_pagbank_id is 'Alternativa a banco_pagbank_id pra empresa sem o módulo "bancos" liberado -- conta do Plano de Contas (deve ser analítica e marcada Caixa/Banco) que recebe o lançamento automático quando um link de pagamento confirma. Mutuamente exclusivo com banco_pagbank_id.';

create or replace function valida_banco_pagbank_da_empresa()
returns trigger
language plpgsql
as $$
begin
  if new.banco_pagbank_id is not null and new.conta_contabil_pagbank_id is not null then
    raise exception 'Escolha banco OU conta do Plano de Contas pro recebimento PagBank, não os dois';
  end if;

  if new.banco_pagbank_id is not null and not exists (
    select 1 from bancos where id = new.banco_pagbank_id and empresa_id = new.id
  ) then
    raise exception 'O banco padrão de recebimento PagBank precisa pertencer à própria empresa';
  end if;

  if new.conta_contabil_pagbank_id is not null and not exists (
    select 1 from plano_contas
    where id = new.conta_contabil_pagbank_id
      and empresa_id = new.id
      and sintetica = false
      and conta_caixa_banco = true
  ) then
    raise exception 'A conta do Plano de Contas pro recebimento PagBank precisa ser analítica, marcada Caixa/Banco e pertencer à própria empresa';
  end if;

  return new;
end;
$$;
