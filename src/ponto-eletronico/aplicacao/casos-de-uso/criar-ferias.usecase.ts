import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { UsuarioAutenticado } from '../../../auth/apresentacao/tipos/requisicao-autenticada';
import { USUARIOS_REPOSITORIO, UsuariosRepositorioPort } from '../../../auth/aplicacao/portas/usuarios-repositorio.port';
import { exigirGestorSobre } from '../exigir-gestor-sobre';
import { FERIAS_PONTO_REPOSITORIO, FeriasPonto, FeriasPontoRepositorioPort } from '../portas/ferias-ponto-repositorio.port';

export interface DadosCriarFerias {
  usuarioAlvoId: string;
  dataInicio: string;
  dataFim: string;
  periodoReferencia: string | null;
  usuarioAtual: UsuarioAutenticado;
}

@Injectable()
export class CriarFeriasUseCase {
  constructor(
    @Inject(FERIAS_PONTO_REPOSITORIO) private readonly feriasRepositorio: FeriasPontoRepositorioPort,
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosCriarFerias): Promise<FeriasPonto> {
    if (dados.dataFim < dados.dataInicio) {
      throw new BadRequestException('Data fim não pode ser antes da data início');
    }

    const funcionario = await this.usuariosRepositorio.buscarPorId(dados.usuarioAlvoId);
    if (!funcionario) throw new NotFoundException('Funcionário não encontrado');
    exigirGestorSobre(dados.usuarioAtual, funcionario);

    const ferias = await this.feriasRepositorio.criar({
      usuarioId: funcionario.id,
      contadorId: funcionario.contadorId,
      empresaId: funcionario.empresaId,
      dataInicio: dados.dataInicio,
      dataFim: dados.dataFim,
      periodoReferencia: dados.periodoReferencia,
      criadoPor: dados.usuarioAtual.id,
    });

    await this.auditoria.registrar({
      usuarioId: dados.usuarioAtual.id,
      contadorId: funcionario.contadorId,
      empresaId: funcionario.empresaId,
      acao: 'CRIAR_FERIAS',
      recurso: `ponto_ferias:${ferias.id}`,
      dadosNovos: { dataInicio: dados.dataInicio, dataFim: dados.dataFim },
    });

    return ferias;
  }
}
