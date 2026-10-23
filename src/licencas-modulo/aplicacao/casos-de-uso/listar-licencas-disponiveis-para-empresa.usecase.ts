import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { PACOTES_MODULOS_REPOSITORIO, PacotesModulosRepositorioPort } from '../../../pacotes-modulos/aplicacao/portas/pacotes-modulos-repositorio.port';
import {
  PLANOS_REVENDA_PACOTE_REPOSITORIO,
  PlanosRevendaPacoteRepositorioPort,
} from '../../../planos-revenda-pacote/aplicacao/portas/planos-revenda-pacote-repositorio.port';
import { LICENCAS_MODULO_REPOSITORIO, LicencasModuloRepositorioPort } from '../portas/licencas-modulo-repositorio.port';

export interface LicencaDisponivelParaEmpresa {
  licencaId: string;
  pacoteId: string;
  nome: string;
  modulos: string[];
  valorVenda: number;
}

/**
 * Licenças do contador dono da empresa que já estão COMPRADAS NO ATACADO (status
 * 'disponivel') e têm plano de revenda ativo pro pacote -- essas a empresa pode ativar
 * sozinha pagando o contador (self-service), sem esperar ele clicar "ativar numa
 * empresa". Licença sem plano de revenda não aparece aqui (sem preço, não tem como a
 * empresa pagar por conta própria -- aí só o contador mesmo, ativando grátis ou cobrando
 * fora desse fluxo).
 */
@Injectable()
export class ListarLicencasDisponiveisParaEmpresaUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(LICENCAS_MODULO_REPOSITORIO) private readonly licencasRepositorio: LicencasModuloRepositorioPort,
    @Inject(PLANOS_REVENDA_PACOTE_REPOSITORIO) private readonly planosRevendaRepositorio: PlanosRevendaPacoteRepositorioPort,
    @Inject(PACOTES_MODULOS_REPOSITORIO) private readonly pacotesRepositorio: PacotesModulosRepositorioPort,
  ) {}

  async executar(empresaId: string): Promise<LicencaDisponivelParaEmpresa[]> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }

    const licencas = await this.licencasRepositorio.listarPorContador(empresa.contadorId);
    const resultado: LicencaDisponivelParaEmpresa[] = [];
    for (const licenca of licencas.filter((l) => l.status === 'disponivel')) {
      const planoRevenda = await this.planosRevendaRepositorio.obterAtivoPorContadorEPacote(empresa.contadorId, licenca.pacoteId);
      if (!planoRevenda) continue;
      const pacote = await this.pacotesRepositorio.obterPorId(licenca.pacoteId);
      if (!pacote) continue;
      resultado.push({
        licencaId: licenca.id,
        pacoteId: licenca.pacoteId,
        nome: planoRevenda.nome ?? pacote.nome,
        modulos: pacote.modulos,
        valorVenda: planoRevenda.valorVenda,
      });
    }
    return resultado;
  }
}
