-- Novo módulo licenciável "fiscal" (separado de "contabilidade", que é núcleo e nunca
-- entra no catálogo) -- cobre tudo que fala com o SERPRO em nome da empresa: DAS,
-- Caixa Postal, CCMEI, Procuração/Certificado. `empresa_tem_modulo()` já é genérica
-- (não tem lista hardcoded, aceita qualquer string de módulo) -- só
-- `empresa_modulos_liberados()` precisa ser atualizada, porque ela tem a lista fixa de
-- "tudo liberado" pra empresa interna (contador/plataforma controlando o próprio negócio).
create or replace function empresa_modulos_liberados(p_empresa_id uuid)
returns text[]
language sql stable security definer set search_path = public
as $$
  select case
    when (select tipo from empresas where id = p_empresa_id) <> 'cliente'
      then array['contratos', 'documentos_societarios', 'conciliacao_bancaria', 'protocolos', 'bancos', 'relatorios', 'fiscal']
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
