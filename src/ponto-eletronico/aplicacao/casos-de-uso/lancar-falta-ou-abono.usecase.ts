import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { UsuarioAutenticado } from '../../../auth/apresentacao/tipos/requisicao-autenticada';
import { USUARIOS_REPOSITORIO, UsuariosRepositorioPort } from '../../../auth/aplicacao/portas/usuarios-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { validarSplitFaltaAbono } from '../../dominio/ponto';
import { StoragePontoService } from '../../infraestrutura/storage-ponto.service';
import { exigirGestorSobre } from '../exigir-gestor-sobre';
import { horarioMeioDiaUtc } from '../intervalo-datas';
import { REGISTROS_PONTO_REPOSITORIO, RegistrosPontoRepositorioPort } from '../portas/registros-ponto-repositorio.port';
import { ArquivoAnexoPonto } from './registrar-batida.usecase';

export interface DadosLancarFaltaOuAbono {
  usuarioAlvoId: string;
  data: string; // YYYY-MM-DD
  horasFalta: number;
  horasAbono: number;
  atestado: ArquivoAnexoPonto | null;
  usuarioAtual: UsuarioAutenticado;
}

/** Falta com atestado pode ser Total (8h abonada) ou Parcial (faltas+abono somam a jornada diária padrão) -- mesma regra do jotaCaixa. */
@Injectable()
export class LancarFaltaOuAbonoUseCase {
  constructor(
    @Inject(REGISTROS_PONTO_REPOSITORIO) private readonly registrosRepositorio: RegistrosPontoRepositorioPort,
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly storage: StoragePontoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosLancarFaltaOuAbono): Promise<void> {
    if (dados.horasFalta <= 0 && dados.horasAbono <= 0) {
      throw new BadRequestException('Informe ao menos horas de falta ou de abono');
    }
    if (!validarSplitFaltaAbono(dados.horasFalta, dados.horasAbono)) {
      throw new BadRequestException('Faltas + abono precisam somar a jornada diária padrão (8h)');
    }

    const funcionario = await this.usuariosRepositorio.buscarPorId(dados.usuarioAlvoId);
    if (!funcionario) throw new NotFoundException('Funcionário não encontrado');
    await exigirGestorSobre(dados.usuarioAtual, funcionario, this.empresasRepositorio);

    const atestadoRef = dados.atestado
      ? await this.storage.armazenarAtestado(funcionario.id, dados.atestado.nomeOriginal, dados.atestado.buffer, dados.atestado.contentType)
      : null;
    const horario = horarioMeioDiaUtc(dados.data);

    if (dados.horasFalta > 0) {
      await this.registrosRepositorio.criar({
        usuarioId: funcionario.id,
        contadorId: funcionario.contadorId,
        empresaId: funcionario.empresaId,
        tipo: 'falta',
        horarioRegistro: horario,
        ajusteManual: true,
        atestadoStorageRef: atestadoRef,
        criadoPor: dados.usuarioAtual.id,
      });
    }
    if (dados.horasAbono > 0) {
      await this.registrosRepositorio.criar({
        usuarioId: funcionario.id,
        contadorId: funcionario.contadorId,
        empresaId: funcionario.empresaId,
        tipo: 'abono',
        horarioRegistro: horario,
        minutosCredito: Math.round(dados.horasAbono * 60),
        ajusteManual: true,
        atestadoStorageRef: atestadoRef,
        criadoPor: dados.usuarioAtual.id,
      });
    }

    await this.auditoria.registrar({
      usuarioId: dados.usuarioAtual.id,
      contadorId: funcionario.contadorId,
      empresaId: funcionario.empresaId,
      acao: 'LANCAR_FALTA_OU_ABONO',
      recurso: `ponto_registros:usuario:${funcionario.id}`,
      dadosNovos: { data: dados.data, horasFalta: dados.horasFalta, horasAbono: dados.horasAbono, temAtestado: !!atestadoRef },
    });
  }
}
