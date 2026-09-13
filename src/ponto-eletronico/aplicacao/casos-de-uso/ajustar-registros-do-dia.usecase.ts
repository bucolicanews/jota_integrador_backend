import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { UsuarioAutenticado } from '../../../auth/apresentacao/tipos/requisicao-autenticada';
import { USUARIOS_REPOSITORIO, UsuariosRepositorioPort } from '../../../auth/aplicacao/portas/usuarios-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { TipoBatida } from '../../dominio/ponto';
import { exigirGestorSobre } from '../exigir-gestor-sobre';
import { intervaloDoDia } from '../intervalo-datas';
import { REGISTROS_PONTO_REPOSITORIO, RegistrosPontoRepositorioPort } from '../portas/registros-ponto-repositorio.port';

export interface BatidaAjustada {
  tipo: TipoBatida;
  horario: string; // ISO
}

export interface DadosAjustarRegistrosDoDia {
  usuarioAlvoId: string;
  data: string; // YYYY-MM-DD
  batidas: BatidaAjustada[];
  usuarioAtual: UsuarioAutenticado;
}

/** Gestor substitui as batidas de um dia inteiro (delete+insert) -- nunca mexe em falta/abono/compensacao/extra100 lançados no mesmo dia. */
@Injectable()
export class AjustarRegistrosDoDiaUseCase {
  constructor(
    @Inject(REGISTROS_PONTO_REPOSITORIO) private readonly registrosRepositorio: RegistrosPontoRepositorioPort,
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosAjustarRegistrosDoDia): Promise<void> {
    const funcionario = await this.usuariosRepositorio.buscarPorId(dados.usuarioAlvoId);
    if (!funcionario) throw new NotFoundException('Funcionário não encontrado');
    await exigirGestorSobre(dados.usuarioAtual, funcionario, this.empresasRepositorio);

    const { inicio, fim } = intervaloDoDia(dados.data);
    await this.registrosRepositorio.excluirBatidasDoDia(funcionario.id, inicio, fim);

    for (const batida of dados.batidas) {
      await this.registrosRepositorio.criar({
        usuarioId: funcionario.id,
        contadorId: funcionario.contadorId,
        empresaId: funcionario.empresaId,
        tipo: batida.tipo,
        horarioRegistro: batida.horario,
        ajusteManual: true,
        criadoPor: dados.usuarioAtual.id,
      });
    }

    await this.auditoria.registrar({
      usuarioId: dados.usuarioAtual.id,
      contadorId: funcionario.contadorId,
      empresaId: funcionario.empresaId,
      acao: 'AJUSTAR_REGISTROS_DO_DIA',
      recurso: `ponto_registros:usuario:${funcionario.id}`,
      dadosNovos: { data: dados.data, quantidadeBatidas: dados.batidas.length },
    });
  }
}
