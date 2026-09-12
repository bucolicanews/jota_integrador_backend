-- configuracao_contratos só tinha as contas do lado CREDOR (receber/receita) --
-- suficiente pro caso original (empresa fatura o próprio cliente). Agora que um contrato
-- pode ter uma EMPRESA como contraparte (emitir_cobranca_interna gera os dois lados),
-- toda empresa que pode ser COBRADA também precisa configurar suas contas do lado
-- DEVEDOR (pagar/despesa) -- mesma tabela serve os dois papéis.
alter table configuracao_contratos add column conta_patrimonial_pagar_id uuid references plano_contas(id);
alter table configuracao_contratos add column conta_resultado_despesa_id uuid references plano_contas(id);

comment on column configuracao_contratos.conta_patrimonial_pagar_id is 'Passivo (a pagar) usado quando esta empresa é a CONTRAPARTE (devedora) de um contrato emitido por outra (ex: contador cobrando a própria empresa-cliente).';
comment on column configuracao_contratos.conta_resultado_despesa_id is 'Despesa correspondente ao conta_patrimonial_pagar_id acima.';

-- Popula a configuração completa (credor + devedor) da empresa interna da Jota, seedada
-- na migration anterior -- ela pode tanto cobrar (admin cobra contador) quanto ser cobrada
-- (não se aplica na prática, mas fica consistente) usando o próprio plano de contas mínimo.
insert into configuracao_contratos (empresa_id, conta_patrimonial_receber_id, conta_resultado_receita_id, conta_patrimonial_pagar_id, conta_resultado_despesa_id)
select
  '00000000-0000-0000-0000-000000000002',
  (select id from plano_contas where empresa_id = '00000000-0000-0000-0000-000000000002' and codigo = '1.1'),
  (select id from plano_contas where empresa_id = '00000000-0000-0000-0000-000000000002' and codigo = '3.1'),
  (select id from plano_contas where empresa_id = '00000000-0000-0000-0000-000000000002' and codigo = '2.1'),
  (select id from plano_contas where empresa_id = '00000000-0000-0000-0000-000000000002' and codigo = '4.1')
on conflict (empresa_id) do update set
  conta_patrimonial_pagar_id = excluded.conta_patrimonial_pagar_id,
  conta_resultado_despesa_id = excluded.conta_resultado_despesa_id;
