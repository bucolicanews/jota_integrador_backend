export type TipoRegistroPonto = 'entrada' | 'saida' | 'falta' | 'abono' | 'compensacao' | 'extra100';
export const TIPOS_REGISTRO_PONTO: TipoRegistroPonto[] = ['entrada', 'saida', 'falta', 'abono', 'compensacao', 'extra100'];

export type TipoBatida = 'entrada' | 'saida';

export const JORNADA_DIARIA_PADRAO_HORAS = 8;

const DIAS_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const;

/** Toggle simples -- próxima ação é sempre a oposta da última batida do dia (sem limite de batidas/dia, igual jotaCaixa). */
export function proximaAcaoBatida(ultimaBatidaDoDia: TipoBatida | null): TipoBatida {
  return ultimaBatidaDoDia === 'entrada' ? 'saida' : 'entrada';
}

/** Falta com atestado só é justificada (não conta como falta injustificada) se soma faltas+abono do dia fechar a jornada diária padrão. */
export function validarSplitFaltaAbono(horasFalta: number, horasAbono: number): boolean {
  return horasFalta + horasAbono === JORNADA_DIARIA_PADRAO_HORAS;
}

export interface RegistroParaResumo {
  tipo: TipoRegistroPonto;
  horarioRegistro: string; // ISO
  minutosCredito: number | null;
}

export interface PeriodoFerias {
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
}

export interface ConfiguracaoJornada {
  horasMensais: number;
  diasFolgaFixos: string[]; // subconjunto de DIAS_SEMANA
  folgaDomingoObrigatoria: boolean;
}

export interface ResumoMensalPonto {
  jornadaMinutos: number;
  trabalhadoMinutos: number;
  /** trabalhado (inclui abono/compensação como crédito) - jornada. Positivo = banco de horas positivo, negativo = devendo. */
  saldoMinutos: number;
  extra100Minutos: number;
  diasFerias: number;
  diasComFaltaInjustificada: number;
  /** Datas (YYYY-MM-DD) de folga fixa trabalhada sem decisão de extra100/compensação ainda -- bloqueiam o fechamento do mês até o gestor decidir. */
  diasQuePrecisamGestao: string[];
}

function dataLocal(horarioIso: string): string {
  return horarioIso.slice(0, 10);
}

function nomeDiaSemana(data: string): (typeof DIAS_SEMANA)[number] {
  // Meio-dia UTC (mesmo truque do jotaCaixa) evita o dia "vazar" pro anterior/seguinte por fuso.
  const dia = new Date(`${data}T12:00:00Z`).getUTCDay();
  return DIAS_SEMANA[dia];
}

function ehDiaDeFolgaFixa(data: string, configuracao: ConfiguracaoJornada): boolean {
  const nome = nomeDiaSemana(data);
  if (nome === 'domingo' && configuracao.folgaDomingoObrigatoria) return true;
  return configuracao.diasFolgaFixos.includes(nome);
}

function somarParesEntradaSaida(batidas: RegistroParaResumo[]): number {
  const ordenadas = [...batidas].sort((a, b) => a.horarioRegistro.localeCompare(b.horarioRegistro));
  let minutos = 0;
  let entradaAberta: string | null = null;

  for (const batida of ordenadas) {
    if (batida.tipo === 'entrada') {
      entradaAberta = batida.horarioRegistro;
    } else if (batida.tipo === 'saida' && entradaAberta) {
      minutos += (new Date(batida.horarioRegistro).getTime() - new Date(entradaAberta).getTime()) / 60_000;
      entradaAberta = null;
    }
    // saída sem entrada aberta, ou entrada sem saída (ainda no trabalho) -- não contam, mesmo critério do jotaCaixa.
  }
  return Math.round(minutos);
}

function contarDiasEmPeriodos(periodos: PeriodoFerias[], ano: number, mes: number): number {
  const inicioMes = new Date(Date.UTC(ano, mes - 1, 1));
  const fimMes = new Date(Date.UTC(ano, mes, 0));
  let dias = 0;

  for (const periodo of periodos) {
    const inicio = new Date(`${periodo.dataInicio}T00:00:00Z`);
    const fim = new Date(`${periodo.dataFim}T00:00:00Z`);
    const inicioEfetivo = inicio < inicioMes ? inicioMes : inicio;
    const fimEfetivo = fim > fimMes ? fimMes : fim;
    if (inicioEfetivo <= fimEfetivo) {
      dias += Math.round((fimEfetivo.getTime() - inicioEfetivo.getTime()) / (24 * 60 * 60_000)) + 1;
    }
  }
  return dias;
}

/**
 * Regra do jotaCaixa: jornada mensal = horas_mensais×60min; saldo = trabalhado−jornada
 * (trabalhado já inclui crédito de abono/compensação); folga fixa trabalhada sem
 * Extra100/Compensação registrado fica pendente de decisão do gestor.
 */
export function calcularResumoMensal(
  registros: RegistroParaResumo[],
  periodosFerias: PeriodoFerias[],
  configuracao: ConfiguracaoJornada,
  ano: number,
  mes: number,
): ResumoMensalPonto {
  const jornadaMinutos = Math.round(configuracao.horasMensais * 60);

  const porDia = new Map<string, RegistroParaResumo[]>();
  for (const registro of registros) {
    const data = dataLocal(registro.horarioRegistro);
    if (!porDia.has(data)) porDia.set(data, []);
    porDia.get(data)!.push(registro);
  }

  let trabalhadoMinutos = 0;
  let extra100Minutos = 0;
  let diasComFaltaInjustificada = 0;
  const diasQuePrecisamGestao: string[] = [];

  for (const [data, registrosDoDia] of porDia) {
    const batidas = registrosDoDia.filter((r): r is RegistroParaResumo & { tipo: TipoBatida } => r.tipo === 'entrada' || r.tipo === 'saida');
    trabalhadoMinutos += somarParesEntradaSaida(batidas);

    const temFalta = registrosDoDia.some((r) => r.tipo === 'falta');
    const temAbono = registrosDoDia.some((r) => r.tipo === 'abono');
    if (temFalta && !temAbono) diasComFaltaInjustificada += 1;

    for (const registro of registrosDoDia) {
      if (registro.tipo === 'abono' || registro.tipo === 'compensacao') {
        trabalhadoMinutos += registro.minutosCredito ?? 0;
      }
      if (registro.tipo === 'extra100') {
        extra100Minutos += registro.minutosCredito ?? 0;
      }
    }

    if (ehDiaDeFolgaFixa(data, configuracao) && batidas.length > 0) {
      const temDecisao = registrosDoDia.some((r) => r.tipo === 'extra100' || r.tipo === 'compensacao');
      if (!temDecisao) diasQuePrecisamGestao.push(data);
    }
  }

  return {
    jornadaMinutos,
    trabalhadoMinutos,
    saldoMinutos: trabalhadoMinutos - jornadaMinutos,
    extra100Minutos,
    diasFerias: contarDiasEmPeriodos(periodosFerias, ano, mes),
    diasComFaltaInjustificada,
    diasQuePrecisamGestao,
  };
}
