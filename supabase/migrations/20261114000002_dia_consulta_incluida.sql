-- Cota incluída tinha período (semanal/mensal/trimestral/anual) mas nenhuma data --
-- na prática a cota era consumida na primeira sincronização depois que o período virava
-- (cron diário, ver DasSincronizacaoCron), nunca num dia escolhido de verdade. Usuário
-- pediu enforcement real: mensal precisa de "dia do mês"; trimestral/semestral/anual
-- precisam também de "qual mês do ciclo" (ex: trimestral mes_do_periodo=2 -> dispara em
-- fev/mai/ago/nov). VerificarCotaIncluidaUseCase passa a só liberar a cota gratuita no
-- dia configurado -- fora dele, cai pro débito normal de crédito.
alter table plano_consultas_incluidas drop constraint plano_consultas_incluidas_periodo_check;
alter table plano_consultas_incluidas
  add constraint plano_consultas_incluidas_periodo_check check (periodo in ('semanal', 'mensal', 'trimestral', 'semestral', 'anual'));

alter table plano_consultas_incluidas
  add column dia_do_mes integer check (dia_do_mes between 1 and 31),
  add column mes_do_periodo integer;

-- Default 1 preserva o comportamento real já em produção pro plano MEI (cron diário
-- sempre batia no dia 1 do período de qualquer forma) -- zero mudança pra quem não editar.
update plano_consultas_incluidas set dia_do_mes = 1 where periodo <> 'semanal';
update plano_consultas_incluidas set mes_do_periodo = 1 where periodo in ('trimestral', 'semestral', 'anual');

alter table plano_consultas_incluidas
  add constraint plano_consultas_incluidas_dia_obrigatorio
    check (periodo = 'semanal' or dia_do_mes is not null);

alter table plano_consultas_incluidas
  add constraint plano_consultas_incluidas_mes_do_periodo_check
    check (
      (periodo in ('mensal', 'semanal') and mes_do_periodo is null)
      or (periodo = 'trimestral' and mes_do_periodo between 1 and 3)
      or (periodo = 'semestral' and mes_do_periodo between 1 and 6)
      or (periodo = 'anual' and mes_do_periodo between 1 and 12)
    );

comment on column plano_consultas_incluidas.dia_do_mes is 'Dia do mês (1-31, truncado pro último dia se o mês for mais curto) em que a cota gratuita fica disponível -- null só permitido quando periodo=semanal.';
comment on column plano_consultas_incluidas.mes_do_periodo is 'Mês do ciclo (1-indexed dentro do período: trimestral 1-3, semestral 1-6, anual 1-12) em que a cota dispara -- null pra mensal/semanal.';
