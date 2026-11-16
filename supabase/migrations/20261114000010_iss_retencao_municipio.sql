-- Transmissão real do PGDAS-D (TRANSDECLARACAO11) precisa, pra receita de serviço,
-- escolher o idAtividade certo (tabela oficial SERPRO, ver reference_serpro_catalogo) --
-- isso depende de retenção de ISS e se é devido a outro município, dado que este sistema
-- nunca capturou até agora (receita de serviço é sempre lançamento manual).

alter table receitas_mensais_historico add column iss_retido_na_fonte boolean not null default false;
alter table receitas_mensais_historico add column iss_devido_a_outro_municipio boolean not null default false;

comment on column receitas_mensais_historico.iss_retido_na_fonte is 'Só relevante pra tipo_atividade=servico -- true quando o tomador reteve o ISS na fonte (retenção/substituição tributária municipal).';
comment on column receitas_mensais_historico.iss_devido_a_outro_municipio is 'Só relevante pra tipo_atividade=servico, quando iss_retido_na_fonte=false -- true quando o ISS é devido ao município do tomador, não ao município do estabelecimento prestador.';
