import { ModoAcessoSerpro, RegimeTributario, StatusEmpresa, TipoEmpresa, TipoPessoaEmpresa } from '../../dominio/empresa';

export interface Empresa {
  id: string;
  contadorId: string;
  tipo: TipoEmpresa;
  /** 'fisica' só é possível quando tipo='interna_contador' -- empresa-cliente é sempre jurídica. */
  tipoPessoa: TipoPessoaEmpresa;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  /** Registro no Conselho Regional de Contabilidade -- obrigatório quando tipoPessoa='fisica', senão sempre null. */
  crc: string | null;
  regimeTributario: RegimeTributario | null;
  modoAcessoSerpro: ModoAcessoSerpro;
  status: StatusEmpresa;
  bloqueado: boolean;
  /** Nome do plano de crédito SERPRO ativo -- só populado em `listarPorContador` (Carteira de Empresas), null nos demais métodos. */
  planoNome: string | null;
  /** E-mail de login do EMPRESARIO_DONO desta empresa (tabela `usuarios`, não `empresas`) -- só populado em `listarPorContador`, null nos demais métodos. Null também se a empresa ainda não tem login criado. */
  emailLogin: string | null;
  /** id do usuário (tabela `usuarios`) por trás de `emailLogin` -- é o id que `PATCH /auth/usuarios/:id/email|senha` espera, nunca o id da empresa. Mesma disponibilidade de `emailLogin`. */
  usuarioLoginId: string | null;
  /** Conta PagBank PRÓPRIA desta empresa -- recebe a parte "seller" de qualquer link de pagamento com split gerado em nome dela. */
  pagbankAccountId: string | null;
  /** Banco (bancos.id) que recebe automaticamente o lançamento quando um link de pagamento confirma. */
  bancoPagbankId: string | null;
  /** Alternativa a bancoPagbankId pra empresa sem o módulo "bancos" liberado -- aponta direto pra uma conta do Plano de Contas (núcleo, sem módulo), mesmo papel de destino do lançamento automático. Mutuamente exclusivo com bancoPagbankId na prática (webhook usa bancoPagbankId se presente, senão este). */
  contaContabilPagbankId: string | null;
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
  tipoPessoa?: TipoPessoaEmpresa;
  crc?: string | null;
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
  /** Empresas-cliente ativas (não bloqueadas) em Modo A (procuração eletrônica) -- usado pelo cron de sincronização de procuração. */
  listarAtivasComProcuracao(): Promise<Empresa[]>;
  atualizar(id: string, dados: DadosAtualizacaoEmpresa): Promise<void>;
  /** Correção pontual de CNPJ já cadastrado errado -- fora de `atualizar()` de propósito (ação sensível, sempre auditada, nunca parte de um PATCH genérico). */
  atualizarCnpj(id: string, cnpj: string): Promise<void>;
  /** Transferir a empresa pra outra carteira (mudar contador_id) -- ação admin-only, sempre auditada, fora de `atualizar()` de propósito. */
  atualizarContadorId(id: string, contadorId: string): Promise<void>;
  atualizarModoAcessoSerpro(id: string, modo: ModoAcessoSerpro): Promise<void>;
  marcarBloqueio(id: string, bloqueado: boolean, motivo: string | null, executadoPorId: string): Promise<void>;
  /** Cadastro manual da conta PagBank própria da empresa + banco padrão de conciliação -- mesmo padrão de contadores.pagbankAccountId. */
  atualizarPagbankConta(
    id: string,
    dados: { pagbankAccountId?: string | null; bancoPagbankId?: string | null; contaContabilPagbankId?: string | null },
  ): Promise<void>;
}

export const EMPRESAS_REPOSITORIO = Symbol('EMPRESAS_REPOSITORIO');
