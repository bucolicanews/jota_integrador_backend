import { Request } from 'express';

export interface RequisicaoAgenteNf extends Request {
  empresaIdAgente: string;
}
