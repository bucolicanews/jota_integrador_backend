-- Separa cadastro de Banco de cadastro de Caixa. Antes desta migration `bancos` era um
-- cadastro único pra qualquer conta marcada `conta_caixa_banco=true` no Plano de Contas
-- (sem diferenciar qual é caixa física e qual é conta bancária de verdade) -- o form
-- "Novo banco" aceitava as duas sem distinção nenhuma. Decisão confirmada com o usuário:
-- mantém a MESMA tabela/módulo `bancos` (evita duplicar CriarBancoUseCase/controller/
-- RLS), só ganha uma coluna `tipo` que a UI usa pra renderizar duas telas de cadastro
-- separadas (Bancos/Caixa) + uma 3ª tela de consolidação ("Contas e Saldos").
--
-- Default 'banco' pras linhas já existentes -- este projeto ainda não tem produção/dado
-- real nesta tabela (confirmado em sessão anterior), então não há registro de caixa
-- físico que precise de correção manual pós-migration.

alter table bancos add column tipo text not null default 'banco'
  check (tipo in ('banco', 'caixa'));

comment on column bancos.tipo is 'Banco (conta bancária de verdade) ou Caixa (dinheiro físico) -- só rotula a mesma conta do Plano de Contas pra UI separar as duas telas de cadastro.';
