import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLIENTES_REPOSITORIO, ClientesRepositorioPort } from '../../../clientes/aplicacao/portas/clientes-repositorio.port';
import { StatusContrato } from '../../dominio/contrato';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../portas/contratos-repositorio.port';

export interface ContratoPublico {
  titulo: string;
  conteudoRenderizado: string;
  clienteNome: string;
  status: StatusContrato;
  valorTotal: number | null;
}

/** Busca SEMPRE por token opaco, nunca por id cru -- devolve só o mínimo necessário pro preview público, nunca campos internos (empresaId, criadoPor, contaReceberId etc). */
@Injectable()
export class ObterContratoPublicoUseCase {
  constructor(
    @Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort,
    @Inject(CLIENTES_REPOSITORIO) private readonly clientes: ClientesRepositorioPort,
  ) {}

  async executar(token: string): Promise<ContratoPublico> {
    const contrato = await this.repositorio.obterContratoPorToken(token);
    if (!contrato) {
      throw new NotFoundException('Contrato não encontrado');
    }
    const cliente = await this.clientes.obterPorId(contrato.clienteId);

    return {
      titulo: contrato.titulo,
      conteudoRenderizado: contrato.conteudoRenderizado,
      clienteNome: cliente?.nome ?? '',
      status: contrato.status,
      valorTotal: contrato.valorTotal,
    };
  }
}
