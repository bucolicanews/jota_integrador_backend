import { Inject, Injectable } from '@nestjs/common';
import {
  PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO,
  PlanoConsultasIncluidasRepositorioPort,
} from '../../../planos/aplicacao/portas/plano-consultas-incluidas-repositorio.port';
import {
  CONSULTAS_SERPRO_REPOSITORIO,
  ConsultasSerproRepositorioPort,
} from '../../../serpro/aplicacao/portas/consultas-serpro-repositorio.port';

/** Início do mês corrente (UTC) -- mesmo período usado em todo o resto do sistema como "mensal", ver [[project_jota_integrador]]. */
function inicioDoPeriodoAtual(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
}

@Injectable()
export class VerificarCotaIncluidaUseCase {
  constructor(
    @Inject(PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO)
    private readonly consultasIncluidasRepositorio: PlanoConsultasIncluidasRepositorioPort,
    @Inject(CONSULTAS_SERPRO_REPOSITORIO) private readonly consultasSerproRepositorio: ConsultasSerproRepositorioPort,
  ) {}

  /** true = esta chamada ainda cabe na cota incluída do plano (não deve debitar crédito). */
  async executar(empresaId: string, planoId: string | null, idSistema: string): Promise<boolean> {
    if (!planoId) {
      return false;
    }
    const cota = await this.consultasIncluidasRepositorio.buscar(planoId, idSistema);
    if (!cota) {
      return false;
    }
    const usoNoPeriodo = await this.consultasSerproRepositorio.contarSucessoNoPeriodo(
      empresaId,
      idSistema,
      inicioDoPeriodoAtual(),
    );
    return usoNoPeriodo < cota.quantidadePorPeriodo;
  }
}
