-- ADMIN_FINANCEIRO/ADMIN_SUPORTE ganham o mesmo teto (todas as ações) dos recursos que já
-- existem no catálogo pra OPERADOR_CONTADOR/OPERADOR_EMPRESA -- reaproveita as linhas de
-- `permissoes` já seedadas, só acrescenta `papel_permissoes` pra esses dois papéis. Zero
-- mudança pra OPERADOR_CONTADOR/OPERADOR_EMPRESA (nenhuma linha deles é tocada). Itens
-- "núcleo" do MenuLateral (Lançamentos, Plano de Contas, Auditoria, DAS, Caixa Postal,
-- Configurações Fiscais, Mapeamento, Sugestões de Extrato) ficam de fora de propósito --
-- não têm `recurso` nem pra operador, são sempre visíveis.
insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('ADMIN_FINANCEIRO', 'ADMIN_SUPORTE')
  and perm.recurso in (
    'bancos', 'clientes', 'conciliacao_bancaria', 'contas_a_pagar', 'contas_a_receber',
    'contratos', 'descricoes_extrato', 'documentos_societarios', 'fornecedores',
    'historicos', 'identificadores_extrato', 'ponto_eletronico', 'protocolos',
    'relatorios', 'suporte'
  )
on conflict (papel_id, permissao_id) do nothing;
