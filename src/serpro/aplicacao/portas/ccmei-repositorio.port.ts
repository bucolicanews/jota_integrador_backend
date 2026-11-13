export interface CcmeiDocumento {
  id: string;
  empresaId: string;
  pdfStorageRef: string | null;
  consultadoEm: string;
  atualizadoEm: string;
}

export interface CcmeiRepositorioPort {
  buscarPorEmpresa(empresaId: string): Promise<CcmeiDocumento | null>;
  /** Cria se não existe, atualiza `pdf_storage_ref` + `consultado_em` se já existe -- 1 registro por empresa (unique empresa_id). */
  upsert(empresaId: string, pdfStorageRef: string): Promise<CcmeiDocumento>;
}

export const CCMEI_REPOSITORIO = Symbol('CCMEI_REPOSITORIO');
