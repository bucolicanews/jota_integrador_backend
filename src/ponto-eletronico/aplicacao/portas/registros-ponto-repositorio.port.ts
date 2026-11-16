import { TipoRegistroPonto } from '../../dominio/ponto';

export interface RegistroPonto {
  id: string;
  usuarioId: string;
  contadorId: string | null;
  empresaId: string | null;
  tipo: TipoRegistroPonto;
  horarioRegistro: string;
  selfieStorageRef: string | null;
  latitude: number | null;
  longitude: number | null;
  ajusteManual: boolean;
  minutosCredito: number | null;
  atestadoStorageRef: string | null;
  observacao: string | null;
  criadoPor: string;
  criadoEm: string;
}

export interface DadosNovoRegistro {
  usuarioId: string;
  contadorId: string | null;
  empresaId: string | null;
  tipo: TipoRegistroPonto;
  horarioRegistro: string;
  selfieStorageRef?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ajusteManual?: boolean;
  minutosCredito?: number | null;
  atestadoStorageRef?: string | null;
  observacao?: string | null;
  criadoPor: string;
}

export interface FiltroRegistros {
  usuarioId: string;
  inicio: string; // ISO, inclusive
  fim: string; // ISO, exclusive
}

export interface RegistrosPontoRepositorioPort {
  criar(dados: DadosNovoRegistro): Promise<RegistroPonto>;
  listar(filtro: FiltroRegistros): Promise<RegistroPonto[]>;
  obterPorId(id: string): Promise<RegistroPonto | null>;
  /** Só considera tipo entrada/saida -- ignora falta/abono/etc ao calcular a próxima ação do toggle. */
  obterUltimaBatidaDoDia(usuarioId: string, inicioDia: string, fimDia: string): Promise<RegistroPonto | null>;
  /** Ajuste manual (delete+insert): remove só entrada/saida do dia, nunca falta/abono/compensacao/extra100 lançados no mesmo dia. */
  excluirBatidasDoDia(usuarioId: string, inicioDia: string, fimDia: string): Promise<void>;
  excluir(id: string): Promise<void>;
  /** Confirma que essa referência de storage realmente pertence a um registro antigo deste
   * usuário -- usado ao "preservar" o atestado numa edição (nunca confiar numa ref crua
   * vinda do client sem checar de quem ela é de verdade). */
  atestadoPertenceAoUsuario(usuarioId: string, atestadoStorageRef: string): Promise<boolean>;
}

export const REGISTROS_PONTO_REPOSITORIO = Symbol('REGISTROS_PONTO_REPOSITORIO');
