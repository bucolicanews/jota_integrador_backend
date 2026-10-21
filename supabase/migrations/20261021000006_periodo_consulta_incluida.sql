-- Período da cota incluída era sempre "mensal" na prática (hardcoded no backend) --
-- usuário pediu configurável (semanal/mensal/trimestral/anual), mesma ideia já descrita
-- na visão original da feature ("no caso mensal mas pode ser outra").
alter table plano_consultas_incluidas
  add column periodo text not null default 'mensal' check (periodo in ('semanal', 'mensal', 'trimestral', 'anual'));

comment on column plano_consultas_incluidas.periodo is 'Granularidade da renovação da cota -- semanal/mensal/trimestral/anual. VerificarCotaIncluidaUseCase calcula o início do período corrente a partir disso.';
