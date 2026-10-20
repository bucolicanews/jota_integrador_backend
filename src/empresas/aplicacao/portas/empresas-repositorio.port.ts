import { ModoAcessoSerpro, RegimeTributario, StatusEmpresa, TipoEmpresa } from '../../dominio/empresa';

export interface Empresa {
  id: string;
  contadorId: string;
  tipo: TipoEmpresa;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  regimeTributario: RegimeTributario | null;
  modoAcessoSerpro: ModoAcessoSerpro;
  status: StatusEmpresa;
  bloqueado: boolean;
}

export interface DadosNovaEmpresa {
  contadorId: string;
  tipo?: TipoEmpresa; // default 'cliente' (mesmo default da coluna) -- só informado explicitamente ao criar empresa interna de contador/plataforma
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  regimeTributario: RegimeTributario | null;
  modoAcessoSerpro: ModoAcessoSerpro;
}

export interface DadosAtualizacaoEmpresa {
  razaoSocial?: string;
  nomeFantasia?: string | null;
  regimeTributario?: RegimeTributario | null;
}

export interface EmpresasRepositorioPort {
  criar(dados: DadosNovaEmpresa): Promise<Empresa>;
  buscarPorId(id: string): Promise<Empresa | null>;
  listarPorContador(contadorId: string): Promise<Empresa[]>;
  /** A empresa interna do próprio contador (tipo='interna_contador') -- nunca aparece em listarPorContador. */
  buscarEmpresaInternaDoContador(contadorId: string): Promise<Empresa | null>;
  /** A empresa interna da própria Jota (tipo='interna_plataforma') -- workspace fixo da plataforma. */
  buscarEmpresaInternaDaPlataforma(): Promise<Empresa | null>;
  /** Usado por outros módulos (ex: auth) pra checar posse sem expor o repositório inteiro. */
  pertenceAoContador(empresaId: string, contadorId: string): Promise<boolean>;
  /** Empresas-cliente ativas (não bloqueadas) num dos regimes informados -- usado pelo cron de sincronização de DAS. */
  listarAtivasPorRegime(regimes: RegimeTributario[]): Promise<Empresa[]>;
  atualizar(id: string, dados: DadosAtualizacaoEmpresa): Promise<void>;
  atualizarModoAcessoSerpro(id: string, modo: ModoAcessoSerpro): Promise<void>;
  marcarBloqueio(id: string, bloqueado: boolean, motivo: string | null, executadoPorId: string): Promise<void>;
}

export const EMPRESAS_REPOSITORIO = Symbol('EMPRESAS_REPOSITORIO');
