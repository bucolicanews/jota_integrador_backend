/** [inicio, fim) do mês em ISO UTC -- usado pra filtrar registros/férias na folha mensal. */
export function intervaloDoMes(ano: number, mes: number): { inicio: string; fim: string } {
  return {
    inicio: new Date(Date.UTC(ano, mes - 1, 1)).toISOString(),
    fim: new Date(Date.UTC(ano, mes, 1)).toISOString(),
  };
}

/** [inicio, fim) do dia (YYYY-MM-DD) em ISO UTC -- usado pro toggle de batida e pro ajuste manual. */
export function intervaloDoDia(data: string): { inicio: string; fim: string } {
  const fim = new Date(`${data}T00:00:00.000Z`);
  fim.setUTCDate(fim.getUTCDate() + 1);
  return { inicio: `${data}T00:00:00.000Z`, fim: fim.toISOString() };
}

/** Meio-dia UTC -- mesmo truque do jotaCaixa pra lançamentos de dia único (falta/abono/compensação/extra100) nunca vazarem pro dia anterior/seguinte por fuso. */
export function horarioMeioDiaUtc(data: string): string {
  return `${data}T12:00:00.000Z`;
}
