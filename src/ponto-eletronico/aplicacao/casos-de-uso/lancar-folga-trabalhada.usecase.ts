import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { UsuarioAutenticado } from '../../../auth/apresentacao/tipos/requisicao-autenticada';
import { USUARIOS_REPOSITORIO, UsuariosRepositorioPort } from '../../../auth/aplicacao/portas/usuarios-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { JORNADA_DIARIA_PADRAO_HORAS } from '../../dominio/ponto';
import { exigirGestorSobre } from '../exigir-gestor-sobre';
import { horarioMeioDiaUtc } from '../intervalo-datas';
import { REGISTROS_PONTO_REPOSITORIO, RegistrosPontoRepositorioPort } from '../portas/registros-ponto-repositorio.port';

export interface DadosLancarFolgaTrabalhada {
  usuarioAlvoId: string;
  data: string; // dia de folga fixa que o funcionário trabalhou
  decisao: 'extra100' | 'compensacao';
  /** Obrigatório quando decisao='compensacao' -- data futura da folga paga. */
  dataCompensacaoFutura: string | null;
  usuarioAtual: UsuarioAutenticado;
}

const MINUTOS_JORNADA_DIARIA = JORNADA_DIARIA_PADRAO_HORAS * 60;

/**
 * Folga fixa trabalhada vira Extra100 (paga como hora extra 100%) ou Compensação (folga
 * futura paga) -- mesma decisão do jotaCaixa. Compensação auto-insere um `abono` de 8h
 * na data futura escolhida, igual jotaCaixa faz.
 */
@Injectable()
export class LancarFolgaTrabalhadaUseCase {
  constructor(
    @Inject(REGISTROS_PONTO_REPOSITORIO) private readonly registrosRepositorio: RegistrosPontoRepositorioPort,
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosLancarFolgaTrabalhada): Promise<void> {
    if (dados.decisao === 'compensacao' && !dados.dataCompensacaoFutura) {
      throw new BadRequestException('Informe a data futura da folga de compensação');
    }

    const funcionario = await this.usuariosRepositorio.buscarPorId(dados.usuarioAlvoId);
    if (!funcionario) throw new NotFoundException('Funcionário não encontrado');
    await exigirGestorSobre(dados.usuarioAtual, funcionario, this.empresasRepositorio);

    const base = {
      usuarioId: funcionario.id,
      contadorId: funcionario.contadorId,
      empresaId: funcionario.empresaId,
      ajusteManual: true,
      criadoPor: dados.usuarioAtual.id,
    };

    if (dados.decisao === 'extra100') {
      await this.registrosRepositorio.criar({
        ...base,
        tipo: 'extra100',
        horarioRegistro: horarioMeioDiaUtc(dados.data),
        minutosCredito: MINUTOS_JORNADA_DIARIA,
      });
    } else {
      await this.registrosRepositorio.criar({
        ...base,
        tipo: 'compensacao',
        horarioRegistro: horarioMeioDiaUtc(dados.data),
        minutosCredito: MINUTOS_JORNADA_DIARIA,
      });
      await this.registrosRepositorio.criar({
        ...base,
        tipo: 'abono',
        horarioRegistro: horarioMeioDiaUtc(dados.dataCompensacaoFutura as string),
        minutosCredito: MINUTOS_JORNADA_DIARIA,
        observacao: `Compensação da folga trabalhada em ${dados.data}`,
      });
    }

    await this.auditoria.registrar({
      usuarioId: dados.usuarioAtual.id,
      contadorId: funcionario.contadorId,
      empresaId: funcionario.empresaId,
      acao: 'LANCAR_FOLGA_TRABALHADA',
      recurso: `ponto_registros:usuario:${funcionario.id}`,
      dadosNovos: { data: dados.data, decisao: dados.decisao, dataCompensacaoFutura: dados.dataCompensacaoFutura },
    });
  }
}
