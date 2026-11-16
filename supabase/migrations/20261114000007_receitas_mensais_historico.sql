-- RBT12 (receita bruta dos últimos 12 meses, base de todo cálculo do Simples Nacional)
-- precisa de histórico mensal segregado por tipo de atividade (comércio/indústria vs.
-- serviço) -- cada um apura em Anexo diferente. Este sistema só captura NFe/NFCe
-- (mercadoria, via notas_fiscais) -- nunca NFS-e (serviço, emitida por cada prefeitura,
-- fora do SERPRO/SEFAZ). Por isso todo mês precisa de um jeito de preencher o que falta
-- à mão: `origem='manual'` sempre que não vier de nota capturada neste sistema.
create type tipo_atividade_receita as enum ('comercio_industria', 'servico');
create type origem_receita_mensal as enum ('notas_fiscais', 'manual');

create table receitas_mensais_historico (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  competencia date not null, -- sempre dia 1 do mês, mesmo padrão de das_mei.competencia
  tipo_atividade tipo_atividade_receita not null,
  valor numeric(14,2) not null check (valor >= 0),
  origem origem_receita_mensal not null default 'manual',
  criado_por uuid references usuarios(id),
  atualizado_em timestamptz not null default now()
);

-- 1 valor por empresa+mês+tipo -- upsert, nunca duplica.
create unique index idx_receitas_mensais_empresa_competencia_tipo on receitas_mensais_historico(empresa_id, competencia, tipo_atividade);

comment on table receitas_mensais_historico is 'Histórico mensal de receita bruta por tipo de atividade, base do cálculo de RBT12. origem=notas_fiscais é só informativo (o valor pode ter sido ajustado à mão depois) -- CalcularRbt12UseCase decide, mês a mês, se usa o que está aqui ou deriva de notas_fiscais na hora.';

alter table receitas_mensais_historico enable row level security;
create policy receitas_mensais_historico_select on receitas_mensais_historico for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy receitas_mensais_historico_insert on receitas_mensais_historico for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy receitas_mensais_historico_update on receitas_mensais_historico for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy receitas_mensais_historico_delete on receitas_mensais_historico for delete to authenticated using (false);
