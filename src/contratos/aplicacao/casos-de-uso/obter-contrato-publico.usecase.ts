import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLIENTES_REPOSITORIO, ClientesRepositorioPort } from '../../../clientes/aplicacao/portas/clientes-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
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
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresas: EmpresasRepositorioPort,
  ) {}

  async executar(token: string): Promise<ContratoPublico> {
    const contrato = await this.repositorio.obterContratoPorToken(token);
    if (!contrato) {
      throw new NotFoundException('Contrato não encontrado');
    }

    // Contrato com empresa como contraparte (ex: ativação de licença) não passa por
    // assinatura pública em v1 -- mas resolve o nome mesmo assim, por completude/segurança.
    let nomeContraparte = '';
    if (contrato.clienteId) {
      const cliente = await this.clientes.obterPorId(contrato.clienteId);
      nomeContraparte = cliente?.nome ?? '';
    } else if (contrato.empresaContraparteId) {
      const empresaContraparte = await this.empresas.buscarPorId(contrato.empresaContraparteId);
      nomeContraparte = empresaContraparte?.razaoSocial ?? '';
    }

    return {
      titulo: contrato.titulo,
      conteudoRenderizado: contrato.conteudoRenderizado,
      clienteNome: nomeContraparte,
      status: contrato.status,
      valorTotal: contrato.valorTotal,
    };
  }
}
