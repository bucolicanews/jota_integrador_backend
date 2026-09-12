import { StatusLicenca } from '../../dominio/licenca-modulo';

export interface LicencaModulo {
  id: string;
  contadorId: string;
  pacoteId: string;
  empresaId: string | null;
  status: StatusLicenca;
  stripeSubscriptionId: string | null;
  ativadoEm: string | null;
  criadoEm: string;
}

export interface DadosNovaLicenca {
  contadorId: string;
  pacoteId: string;
  stripeSubscriptionId: string | null;
}

export interface LicencasModuloRepositorioPort {
  criar(dados: DadosNovaLicenca): Promise<LicencaModulo>;
  listarPorContador(contadorId: string): Promise<LicencaModulo[]>;
  obterPorId(id: string): Promise<LicencaModulo | null>;
  buscarPorStripeSubscriptionId(stripeSubscriptionId: string): Promise<LicencaModulo | null>;
  ativar(id: string, empresaId: string): Promise<void>;
  desativar(id: string): Promise<void>;
  cancelar(id: string): Promise<void>;

  jaProcessouEventoWebhook(gateway: string, eventoId: string): Promise<boolean>;
  marcarEventoWebhookProcessado(gateway: string, eventoId: string): Promise<void>;
}

export const LICENCAS_MODULO_REPOSITORIO = Symbol('LICENCAS_MODULO_REPOSITORIO');
