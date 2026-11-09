-- O default de contadores.modulos_liberados (migration 20261103000002) esqueceu o
-- núcleo contábil -- só tinha conciliacao_bancaria/bancos/fiscal/protocolos/contratos/
-- documentos_societarios/relatorios, nunca lancamentos/contas_a_pagar/contas_a_receber/
-- plano_contas/clientes/fornecedores/historicos. Resultado: contador não via Plano de
-- Contas (nem a seção "Cadastros" inteira, que desaparece do menu quando fica vazia) no
-- próprio escritório -- bug real encontrado em 2026-11-09, não falta de permissão.

alter table contadores
  alter column modulos_liberados set default array[
    'conciliacao_bancaria', 'bancos', 'fiscal', 'protocolos', 'contratos', 'documentos_societarios', 'relatorios',
    'lancamentos', 'contas_a_pagar', 'contas_a_receber', 'plano_contas', 'clientes', 'fornecedores', 'historicos'
  ];

-- Backfill: só ADICIONA o que falta em quem já existe -- nunca remove um módulo que o
-- admin já tenha desligado manualmente de propósito (não existe UI pra isso ainda, mas
-- não custa ser conservador).
update contadores
set modulos_liberados = (
  select array_agg(distinct modulo)
  from unnest(
    modulos_liberados || array[
      'lancamentos', 'contas_a_pagar', 'contas_a_receber', 'plano_contas', 'clientes', 'fornecedores', 'historicos'
    ]
  ) as modulo
);
