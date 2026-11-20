import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { ConsultarRtcRegimeRegularUseCase, ResultadoRtcRegimeRegular } from './consultar-rtc-regime-regular.usecase';
import { ConsultarRtcSimplesNacionalUseCase, ResultadoRtcSimplesNacional } from './consultar-rtc-simples-nacional.usecase';

export type ResultadoApuracaoRtc =
  | { calculador: 'simples_nacional'; resultado: ResultadoRtcSimplesNacional }
  | { calculador: 'regime_regular'; resultado: ResultadoRtcRegimeRegular };

/**
 * Decide, por empresa, qual dos 2 calculadores RTC da RFB chamar -- nunca os dois. Regra
 * (ver comment de `empresas.apuracao_ibs_cbs_hibrida`, migration 20261114000006):
 *
 * - lucro_presumido/lucro_real/lucro_arbitrado -> Regime Regular, sempre.
 * - simples_nacional/mei com apuracaoIbsCbsHibrida=true -> Regime Regular (mesmo cálculo
 *   débito-crédito não-cumulativo de quem está em lucro presumido).
 * - simples_nacional/mei com apuracaoIbsCbsHibrida=false (ou mei sem o campo, que nunca tem
 *   efeito pra ele) -> Simples Nacional, embutido no DAS.
 *
 * Único ponto de entrada recomendado pro painel de Apuração Tributária -- os 2 usecases
 * individuais seguem existindo pra quem já sabe qual calculador quer (ex. debug, teste
 * isolado), com a mesma regra de elegibilidade duplicada neles por segurança.
 */
@Injectable()
export class ConsultarApuracaoRtcUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly consultarSimplesNacional: ConsultarRtcSimplesNacionalUseCase,
    private readonly consultarRegimeRegular: ConsultarRtcRegimeRegularUseCase,
  ) {}

  async executar(empresaId: string, competencia: string): Promise<ResultadoApuracaoRtc> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) throw new NotFoundException('Empresa não encontrada');

    switch (empresa.regimeTributario) {
      case 'lucro_presumido':
      case 'lucro_real':
      case 'lucro_arbitrado':
        return { calculador: 'regime_regular', resultado: await this.consultarRegimeRegular.executar(empresaId, competencia) };

      case 'simples_nacional':
      case 'mei':
        if (empresa.apuracaoIbsCbsHibrida) {
          return { calculador: 'regime_regular', resultado: await this.consultarRegimeRegular.executar(empresaId, competencia) };
        }
        return { calculador: 'simples_nacional', resultado: await this.consultarSimplesNacional.executar(empresaId, competencia) };

      default:
        throw new BadRequestException('Empresa sem regime tributário definido -- não há calculador RTC pra escolher');
    }
  }
}
