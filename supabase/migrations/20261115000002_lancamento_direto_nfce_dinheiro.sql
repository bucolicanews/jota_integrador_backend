-- NFCe 100% dinheiro à vista deixa de passar por Contas a Receber inteiramente -- agora
-- gera 1 lançamento direto (D Caixa/Banco / C Receita de Venda) na aprovação, em vez do
-- par emissão (D Clientes a Receber/C Receita) + baixa (D Caixa/C Clientes a Receber) que
-- deixava toda venda à vista aparecendo na tela de Contas a Receber com status "Recebida"
-- (confuso -- aquela tela devia mostrar só venda realmente a prazo/pendente de conciliação).
-- origem 'notas_fiscais' identifica esse lançamento direto, nunca aparece em contas_a_receber.

alter table lancamentos_contabeis drop constraint lancamentos_contabeis_origem_check;
alter table lancamentos_contabeis add constraint lancamentos_contabeis_origem_check
  check (origem in ('manual', 'contas_a_pagar', 'contas_a_receber', 'contrato', 'conciliacao_bancaria', 'das', 'notas_fiscais', 'estorno'));
