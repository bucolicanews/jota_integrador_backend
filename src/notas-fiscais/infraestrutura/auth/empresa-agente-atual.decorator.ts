import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequisicaoAgenteNf } from './requisicao-agente';

export const EmpresaAgenteAtual = createParamDecorator((_dados: unknown, context: ExecutionContext): string => {
  const requisicao = context.switchToHttp().getRequest<RequisicaoAgenteNf>();
  return requisicao.empresaIdAgente;
});
