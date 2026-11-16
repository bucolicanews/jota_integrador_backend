-- "Simples Híbrido" não é um regime novo -- é a empresa (já regime_tributario=
-- 'simples_nacional') optar por apurar CBS/IBS separadamente (débito das vendas menos
-- crédito das compras, não-cumulativo, igual lucro presumido) em vez de deixar embutido
-- no DAS unificado (regra geral do Simples). Por isso é um booleano à parte, não um 6º
-- valor no enum de regime -- assim nenhuma das 9+ checagens "regime !== simples_nacional"
-- já existentes no módulo DAS/CCMEI precisa mudar; só o painel de Apuração Tributária
-- (novo) lê este campo.
alter table empresas add column apuracao_ibs_cbs_hibrida boolean not null default false;

comment on column empresas.apuracao_ibs_cbs_hibrida is 'Só tem efeito quando regime_tributario=simples_nacional. true = apura CBS/IBS por fora do DAS (débito-crédito, igual lucro presumido). Nunca usado pelo módulo DAS/CCMEI, só pelo painel de Apuração Tributária.';
