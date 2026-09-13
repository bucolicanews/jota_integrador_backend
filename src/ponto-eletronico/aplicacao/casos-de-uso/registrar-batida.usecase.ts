import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { UsuarioAutenticado } from '../../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../../auth/dominio/papel';
import { proximaAcaoBatida } from '../../dominio/ponto';
import { StoragePontoService } from '../../infraestrutura/storage-ponto.service';
import { intervaloDoDia } from '../intervalo-datas';
import { REGISTROS_PONTO_REPOSITORIO, RegistroPonto, RegistrosPontoRepositorioPort } from '../portas/registros-ponto-repositorio.port';

export interface ArquivoAnexoPonto {
  nomeOriginal: string;
  buffer: Buffer;
  contentType: string;
}

export interface DadosRegistrarBatida {
  selfie: ArquivoAnexoPonto;
  latitude: number | null;
  longitude: number | null;
  usuarioAtual: UsuarioAutenticado;
}

/** Só o próprio funcionário (OPERADOR_CONTADOR/OPERADOR_EMPRESA) bate o próprio ponto -- donos/plataforma nunca batem, só gerenciam. */
@Injectable()
export class RegistrarBatidaUseCase {
  constructor(
    @Inject(REGISTROS_PONTO_REPOSITORIO) private readonly registrosRepositorio: RegistrosPontoRepositorioPort,
    private readonly storage: StoragePontoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosRegistrarBatida): Promise<RegistroPonto> {
    const { usuarioAtual } = dados;

    if (usuarioAtual.papel !== Papel.OPERADOR_CONTADOR && usuarioAtual.papel !== Papel.OPERADOR_EMPRESA) {
      throw new ForbiddenException('Só funcionários batem ponto -- donos e plataforma só gerenciam');
    }

    const contadorId = usuarioAtual.papel === Papel.OPERADOR_CONTADOR ? usuarioAtual.contadorId : null;
    const empresaId = usuarioAtual.papel === Papel.OPERADOR_EMPRESA ? usuarioAtual.empresaId : null;
    if (!contadorId && !empresaId) {
      throw new ForbiddenException('Usuário sem vínculo de contador/empresa');
    }

    const agora = new Date();
    const dataHoje = agora.toISOString().slice(0, 10);
    const { inicio, fim } = intervaloDoDia(dataHoje);

    const ultimaBatida = await this.registrosRepositorio.obterUltimaBatidaDoDia(usuarioAtual.id, inicio, fim);
    const proximaAcao = proximaAcaoBatida(ultimaBatida ? (ultimaBatida.tipo as 'entrada' | 'saida') : null);

    const selfieRef = await this.storage.armazenarSelfie(usuarioAtual.id, dados.selfie.nomeOriginal, dados.selfie.buffer, dados.selfie.contentType);

    const registro = await this.registrosRepositorio.criar({
      usuarioId: usuarioAtual.id,
      contadorId,
      empresaId,
      tipo: proximaAcao,
      horarioRegistro: agora.toISOString(),
      selfieStorageRef: selfieRef,
      latitude: dados.latitude,
      longitude: dados.longitude,
      criadoPor: usuarioAtual.id,
    });

    await this.auditoria.registrar({
      usuarioId: usuarioAtual.id,
      contadorId,
      empresaId,
      acao: proximaAcao === 'entrada' ? 'BATER_PONTO_ENTRADA' : 'BATER_PONTO_SAIDA',
      recurso: `ponto_registros:${registro.id}`,
    });

    return registro;
  }
}
