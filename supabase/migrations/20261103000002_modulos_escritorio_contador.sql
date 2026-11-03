-- Admin controla quais módulos o ESCRITÓRIO do contador (empresa tipo interna_contador)
-- pode usar pra própria contabilidade -- nunca afeta empresa-cliente da carteira (essas
-- continuam 100% via plano da assinatura, migration 20261026000002). Default = tudo
-- liberado (mesmo comportamento histórico de interna_contador, que até agora sempre
-- passava incondicional em empresa_tem_modulo).
alter table contadores add column modulos_liberados text[] not null default array[
  'conciliacao_bancaria', 'bancos', 'fiscal', 'protocolos', 'contratos', 'documentos_societarios', 'relatorios'
];

comment on column contadores.modulos_liberados is 'Módulos que o escritório do próprio contador (empresas.tipo=interna_contador) pode usar. Editável só pelo admin (RLS igual ao resto de contadores). Nunca gate empresa-cliente -- essa continua via planos.modulos/assinaturas.';

create or replace function empresa_tem_modulo(p_empresa_id uuid, p_modulo text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when (select tipo from empresas where id = p_empresa_id) = 'interna_plataforma' then true
    when (select tipo from empresas where id = p_empresa_id) = 'interna_contador' then
      exists (
        select 1 from contadores c
        join empresas e on e.contador_id = c.id
        where e.id = p_empresa_id and p_modulo = any(c.modulos_liberados)
      )
    else exists (
      select 1 from assinaturas a
      join planos p on p.id = a.plano_id
      where a.empresa_id = p_empresa_id and a.status = 'ativa' and p_modulo = any(p.modulos)
    )
  end
$$;

create or replace function empresa_modulos_liberados(p_empresa_id uuid)
returns text[]
language sql stable security definer set search_path = public
as $$
  select case
    when (select tipo from empresas where id = p_empresa_id) = 'interna_plataforma'
      then array['contratos', 'documentos_societarios', 'conciliacao_bancaria', 'protocolos', 'bancos', 'relatorios', 'fiscal']
    when (select tipo from empresas where id = p_empresa_id) = 'interna_contador'
      then coalesce(
        (select c.modulos_liberados from contadores c join empresas e on e.contador_id = c.id where e.id = p_empresa_id),
        array[]::text[]
      )
    else coalesce(
      (
        select p.modulos
        from assinaturas a
        join planos p on p.id = a.plano_id
        where a.empresa_id = p_empresa_id and a.status = 'ativa'
        limit 1
      ),
      array[]::text[]
    )
  end
$$;
