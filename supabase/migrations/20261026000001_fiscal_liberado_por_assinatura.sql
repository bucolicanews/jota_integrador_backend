-- Decisão do usuário (2026-10-26): elimina a colisão de nome entre "Plano Fiscal"
-- (assinatura de créditos SERPRO, tabela assinaturas) e o módulo licenciável "fiscal"
-- (licencas_modulo/pacotes_modulos, que gate o menu DAS/Caixa Postal). Empresa com
-- assinatura ATIVA já libera o módulo fiscal, sem precisar ativar licença separada.
-- Só esse módulo -- os outros 6 (contratos, documentos_societarios, conciliacao_bancaria,
-- protocolos, bancos, relatorios) continuam exclusivamente via licencas_modulo, sem
-- mudança. Isso contraria o comentário original em planos.modulos (migration
-- 20260913000004_planos_enriquecidos.sql, "não criar segundo caminho concorrente de
-- liberação") de propósito -- aquele comentário falava de planos.modulos (vitrine, por
-- CONTADOR), aqui o sinal novo é assinaturas.status (por EMPRESA), e a decisão de
-- unificar foi pedida explicitamente pro módulo fiscal.
create or replace function empresa_tem_modulo(p_empresa_id uuid, p_modulo text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    (select tipo from empresas where id = p_empresa_id) <> 'cliente'
    or exists (
      select 1 from licencas_modulo lm
      join pacotes_modulos pm on pm.id = lm.pacote_id
      where lm.empresa_id = p_empresa_id and lm.status = 'ativa' and p_modulo = any(pm.modulos)
    )
    or (
      p_modulo = 'fiscal'
      and exists (select 1 from assinaturas a where a.empresa_id = p_empresa_id and a.status = 'ativa')
    )
$$;

create or replace function empresa_modulos_liberados(p_empresa_id uuid)
returns text[]
language sql stable security definer set search_path = public
as $$
  select case
    when (select tipo from empresas where id = p_empresa_id) <> 'cliente'
      then array['contratos', 'documentos_societarios', 'conciliacao_bancaria', 'protocolos', 'bancos', 'relatorios', 'fiscal']
    else (
      select array(
        select distinct modulo from (
          select modulo
          from licencas_modulo lm
          join pacotes_modulos pm on pm.id = lm.pacote_id
          cross join unnest(pm.modulos) as modulo
          where lm.empresa_id = p_empresa_id and lm.status = 'ativa'
          union
          select 'fiscal' where exists (
            select 1 from assinaturas a where a.empresa_id = p_empresa_id and a.status = 'ativa'
          )
        ) t(modulo)
      )
    )
  end
$$;
