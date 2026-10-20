-- Chamada real contra o ambiente trial do SERPRO (CONSDECLARACAO13/CONSEXTRATO16)
-- confirmou que o extrato do PGDASD devolve só {numeroDas, extrato:{nomeArquivo, pdf}}
-- -- SEM valor/vencimento estruturado (o valor só existe impresso dentro do PDF). O
-- mesmo vale pro PGMEI (GERARDASPDF21), cujo shape de sucesso não foi possível
-- confirmar (cenário trial retornou "Dados inválidos" em toda tentativa testada).
--
-- Em vez de fabricar um valor (0 seria enganoso num app financeiro), `valor`/`valor_das`
-- passam a aceitar NULL -- a aplicação mostra "—" até confirmar contra produção se o
-- SERPRO real expõe esse campo em algum outro serviço (ex: PAGTOWEB/PAGAMENTOS71 depois
-- do pagamento, que já é consumido por este módulo). CHECK (valor >= 0) já aceita NULL
-- sem violação (comportamento padrão de CHECK no Postgres), não precisa recriar.

alter table das_mei alter column valor drop not null;
alter table declaracoes_pgdas alter column valor_das drop not null;
-- Mesma razão -- CONSDECLARACAO13/CONSEXTRATO16 confirmados não trazem receita bruta
-- estruturada (só numeroDas/dasPago/pdf); 0 seria "declarou receita zero", falso.
alter table declaracoes_pgdas alter column receita_bruta drop not null;

comment on column das_mei.valor is 'NULL quando o SERPRO não devolveu valor estruturado nesta sincronização (trial do GERARDASPDF21 nunca confirmado) -- o PDF em pdf_storage_ref tem o valor impresso.';
comment on column declaracoes_pgdas.valor_das is 'NULL quando o SERPRO não devolveu valor estruturado (CONSEXTRATO16 confirmado só traz {numeroDas, extrato:{nomeArquivo,pdf}}, sem valor) -- o PDF em pdf_storage_ref tem o valor impresso.';
