-- Lista os módulos liberados de uma empresa (usado pelo frontend pra montar o menu lateral
-- condicional). Mesma regra de bypass de empresa_tem_modulo: tipo != 'cliente' (contador/Jota
-- controlando o próprio negócio) sempre vê tudo.
create or replace function empresa_modulos_liberados(p_empresa_id uuid)
returns text[]
language sql stable security definer set search_path = public
as $$
  select case
    when (select tipo from empresas where id = p_empresa_id) <> 'cliente'
      then array['contratos', 'documentos_societarios', 'conciliacao_bancaria', 'protocolos', 'bancos', 'relatorios']
    else coalesce(
      (
        select array_agg(distinct modulo)
        from licencas_modulo lm
        join pacotes_modulos pm on pm.id = lm.pacote_id
        cross join unnest(pm.modulos) as modulo
        where lm.empresa_id = p_empresa_id and lm.status = 'ativa'
      ),
      array[]::text[]
    )
  end
$$;
