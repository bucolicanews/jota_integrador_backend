-- Assinatura ficava `status='ativa'` pra sempre mesmo depois de `fim_em` passar -- nada
-- revogava acesso real nem avisava a empresa que precisava renovar (bug real reportado
-- 2026-10-26). Dois reforços, defesa em profundidade:
-- 1) `empresa_tem_modulo`/`empresa_modulos_liberados` passam a checar `fim_em` em tempo
--    real -- sem depender do cron ter rodado ainda (zero atraso).
-- 2) Status novo `vencida` + cron horário (AssinaturasVencimentoCron) deixam o campo
--    `status` em si verdadeiro -- telas que mostram status cru (ex: Carteira de Empresas)
--    continuam corretas mesmo sem reconsultar `fim_em` de novo.
alter table assinaturas drop constraint assinaturas_status_check;
alter table assinaturas add constraint assinaturas_status_check check (status in ('ativa', 'vencida', 'bloqueada', 'cancelada'));

create or replace function empresa_tem_modulo(p_empresa_id uuid, p_modulo text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    (select tipo from empresas where id = p_empresa_id) <> 'cliente'
    or exists (
      select 1 from assinaturas a
      join planos p on p.id = a.plano_id
      where a.empresa_id = p_empresa_id and a.status = 'ativa'
        and (a.fim_em is null or a.fim_em >= now())
        and p_modulo = any(p.modulos)
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
          and (a.fim_em is null or a.fim_em >= now())
        limit 1
      ),
      array[]::text[]
    )
  end
$$;
