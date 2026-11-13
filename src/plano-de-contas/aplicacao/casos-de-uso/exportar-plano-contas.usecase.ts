import { Inject, Injectable } from '@nestjs/common';
import { construirCsvPlanoContas } from '../../dominio/parser-plano-contas';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../portas/plano-contas-repositorio.port';

@Injectable()
export class ExportarPlanoContasUseCase {
  constructor(
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly repositorio: PlanoContasRepositorioPort,
  ) {}

  async executar(empresaId: string): Promise<string> {
    const contas = await this.repositorio.listarPorEmpresa(empresaId);
    const porId = new Map(contas.map((conta) => [conta.id, conta]));

    return construirCsvPlanoContas(
      contas.map((conta) => ({
        codigo: conta.codigo,
        nome: conta.nome,
        grupo: conta.grupo,
        sintetica: conta.sintetica,
        codigoPai: conta.contaPaiId ? porId.get(conta.contaPaiId)?.codigo ?? null : null,
        contaCaixaBanco: conta.contaCaixaBanco,
        tipoCaixaBanco: conta.tipoCaixaBanco,
        contaAReceber: conta.contaAReceber,
        contaAPagar: conta.contaAPagar,
      })),
    );
  }
}
