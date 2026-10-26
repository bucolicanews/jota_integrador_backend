import { Controller, ForbiddenException, Inject, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { EMPRESAS_REPOSITORIO, Empresa, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { ResultadoTesteConexao, TestarConexaoSerproUseCase } from '../aplicacao/casos-de-uso/testar-conexao-serpro.usecase';

/**
 * Rota separada de SerproController -- de propósito SEM @ExigirModulo('fiscal')/ModulosGuard,
 * porque testar a conexão precisa funcionar mesmo numa empresa recém-cadastrada que ainda
 * não tem módulo fiscal liberado nem plano ativo (é justamente o passo de setup que vem
 * antes disso). Continua exigindo autenticação + posse normalmente.
 */
@Controller('empresas/:empresaId/serpro')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class TestarConexaoSerproController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly testarConexao: TestarConexaoSerproUseCase,
  ) {}

  @Post('testar-conexao')
  async testar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoTesteConexao> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    this.exigirPosse(usuarioAtual, empresa);

    return this.testarConexao.executar(empresaId);
  }

  /** Mesmo padrão de posse de SerproController/EmpresasController. */
  private exigirPosse(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) return;
    const ehContadorDono = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === empresa.contadorId;
    const ehDaPropriaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === empresa.id;
    if (!ehContadorDono && !ehDaPropriaEmpresa) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }
}
