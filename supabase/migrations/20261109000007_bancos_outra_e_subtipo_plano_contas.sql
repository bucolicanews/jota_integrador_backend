-- "Outra" (Aplicação/Investimento/Cartão etc) -- 3º tipo de bancos.tipo, igual banco/caixa:
-- registro próprio em `bancos`, entra no saldo consolidado de /contas-saldos, mas não é
-- caixa física nem conta bancária de movimento corrente.
alter table bancos drop constraint bancos_tipo_check;
alter table bancos add constraint bancos_tipo_check check (tipo in ('banco', 'caixa', 'outra'));

-- Plano de Contas ganha o MESMO subtipo. `conta_caixa_banco` continua sendo o gênero
-- ("esta conta é líquida, usada na conciliação bancária"); `tipo_caixa_banco` é a espécie
-- (caixa/banco/outra) -- sem isso, o select de "Novo caixa"/"Novo banco"/"Nova conta" em
-- /contas-saldos não tem como filtrar só as contas certas (o flag genérico sozinho não
-- diferencia uma caixa física de uma conta bancária). Nullable -- só preenchido quando
-- conta_caixa_banco=true; fica null em qualquer outra conta.
alter table plano_contas add column tipo_caixa_banco text
  check (tipo_caixa_banco in ('caixa', 'banco', 'outra'));

comment on column plano_contas.tipo_caixa_banco is 'Subtipo de conta_caixa_banco=true -- caixa/banco/outra, usado pra filtrar o select de cada tela de cadastro (Bancos/Caixa/Contas e Saldos). Null quando conta_caixa_banco=false.';
