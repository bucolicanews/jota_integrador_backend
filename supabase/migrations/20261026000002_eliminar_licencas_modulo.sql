-- Elimina o sistema de licenças-módulo (licencas_modulo/pacotes_modulos/
-- planos_revenda_pacote/pagamentos_compra_atacado_licenca) por completo. Decisão do
-- usuário (2026-10-26): generaliza pra todos os 7 módulos o que a migration anterior
-- (20261026000001_fiscal_liberado_por_assinatura.sql) só tinha feito pro módulo
-- "fiscal" -- agora TODO módulo vem de planos.modulos (vitrine que passa a valer de
-- verdade) via assinatura ativa da empresa. planos_revenda_pacote caiu em cascata: só
-- existia pra revender pacote de módulo, que deixou de existir.
create or replace function empresa_tem_modulo(p_empresa_id uuid, p_modulo text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    (select tipo from empresas where id = p_empresa_id) <> 'cliente'
    or exists (
      select 1 from assinaturas a
      join planos p on p.id = a.plano_id
      where a.empresa_id = p_empresa_id and a.status = 'ativa' and p_modulo = any(p.modulos)
    )
$$;

create or replace function empresa_modulos_liberados(p_empresa_id uuid)
returns text[]
language sql stable security definer set search_path = public
as $$
  select case
    when (select tipo from empresas where id = p_empresa_id) <> 'cliente'
      then array['contratos', 'documentos_societarios', 'conciliacao_bancaria', 'protocolos', 'bancos', 'relatorios', 'fiscal']
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

drop table if exists pagamentos_compra_atacado_licenca cascade;
drop table if exists licencas_modulo cascade;
drop table if exists planos_revenda_pacote cascade;
drop table if exists pacotes_modulos cascade;

delete from papel_permissoes where permissao_id in (
  select id from permissoes where recurso in ('licencas_modulo', 'pacotes_modulos')
);
delete from permissoes where recurso in ('licencas_modulo', 'pacotes_modulos');
