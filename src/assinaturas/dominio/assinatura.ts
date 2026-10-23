import { Periodicidade } from '../../planos/dominio/plano';

export type StatusAssinatura = 'ativa' | 'bloqueada' | 'cancelada';

/**
 * Próximo "válido até" depois de um pagamento confirmado -- renova a PARTIR do fim do
 * ciclo atual se ele ainda não passou (pagar adiantado não perde os dias restantes),
 * ou a partir de agora se já expirou/nunca teve um.
 */
export function proximoFimPeriodo(fimAtual: Date | null, periodicidade: Periodicidade, agora: Date = new Date()): Date {
  const base = fimAtual && fimAtual > agora ? new Date(fimAtual) : new Date(agora);
  if (periodicidade === 'anual') {
    base.setFullYear(base.getFullYear() + 1);
  } else {
    base.setMonth(base.getMonth() + 1);
  }
  return base;
}
