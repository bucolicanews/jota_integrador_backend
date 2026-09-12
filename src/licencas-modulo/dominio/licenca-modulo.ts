export type StatusLicenca = 'disponivel' | 'ativa' | 'cancelada';

export function podeAtivar(status: StatusLicenca): boolean {
  return status === 'disponivel';
}

export function podeDesativar(status: StatusLicenca): boolean {
  return status === 'ativa';
}
