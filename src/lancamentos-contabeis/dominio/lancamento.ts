export type OrigemLancamento =
  | 'manual'
  | 'contas_a_pagar'
  | 'contas_a_receber'
  | 'contrato'
  | 'conciliacao_bancaria'
  | 'das'
  | 'estorno';

export const ORIGENS_LANCAMENTO: OrigemLancamento[] = [
  'manual',
  'contas_a_pagar',
  'contas_a_receber',
  'contrato',
  'conciliacao_bancaria',
  'das',
  'estorno',
];

export type TipoPartida = 'debito' | 'credito';
export const TIPOS_PARTIDA: TipoPartida[] = ['debito', 'credito'];
