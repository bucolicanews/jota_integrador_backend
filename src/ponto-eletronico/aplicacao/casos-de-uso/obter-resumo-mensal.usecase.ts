import { Inject, Injectable } from '@nestjs/common';
import { calcularResumoMensal, ResumoMensalPonto } from '../../dominio/ponto';
import { intervaloDoMes } from '../intervalo-datas';
import {
  CONFIGURACAO_FUNCIONARIO_REPOSITORIO,
  ConfiguracaoFuncionarioRepositorioPort,
} from '../portas/configuracao-funcionario-repositorio.port';
import { FERIAS_PONTO_REPOSITORIO, FeriasPontoRepositorioPort } from '../portas/ferias-ponto-repositorio.port';
import { REGISTROS_PONTO_REPOSITORIO, RegistrosPontoRepositorioPort } from '../portas/registros-ponto-repositorio.port';

const CONFIGURACAO_PADRAO = { horasMensais: 220, diasFolgaFixos: [] as string[], folgaDomingoObrigatoria: true };

/** Posse já validada pelo controller antes de chamar. */
@Injectable()
export class ObterResumoMensalUseCase {
  constructor(
    @Inject(REGISTROS_PONTO_REPOSITORIO) private readonly registrosRepositorio: RegistrosPontoRepositorioPort,
    @Inject(FERIAS_PONTO_REPOSITORIO) private readonly feriasRepositorio: FeriasPontoRepositorioPort,
    @Inject(CONFIGURACAO_FUNCIONARIO_REPOSITORIO) private readonly configuracaoRepositorio: ConfiguracaoFuncionarioRepositorioPort,
  ) {}

  async executar(usuarioId: string, ano: number, mes: number): Promise<ResumoMensalPonto> {
    const { inicio, fim } = intervaloDoMes(ano, mes);

    const [registros, ferias, configuracao] = await Promise.all([
      this.registrosRepositorio.listar({ usuarioId, inicio, fim }),
      this.feriasRepositorio.listarPorUsuarioNoIntervalo(usuarioId, inicio, fim),
      this.configuracaoRepositorio.obterPorUsuario(usuarioId),
    ]);

    return calcularResumoMensal(
      registros.map((r) => ({ tipo: r.tipo, horarioRegistro: r.horarioRegistro, minutosCredito: r.minutosCredito })),
      ferias.map((f) => ({ dataInicio: f.dataInicio, dataFim: f.dataFim })),
      configuracao ?? CONFIGURACAO_PADRAO,
      ano,
      mes,
    );
  }
}
