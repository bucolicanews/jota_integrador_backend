import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CriarContratoUseCase } from '../../../contratos/aplicacao/casos-de-uso/criar-contrato.usecase';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../../../contratos/aplicacao/portas/contratos-repositorio.port';
import { ModoParcelamento } from '../../../contas-a-receber/dominio/conta-receber';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { PACOTES_MODULOS_REPOSITORIO, PacotesModulosRepositorioPort } from '../../../pacotes-modulos/aplicacao/portas/pacotes-modulos-repositorio.port';
import { pacoteExpirado } from '../../../pacotes-modulos/dominio/pacote-modulos';
import { podeAtivar } from '../../dominio/licenca-modulo';
import { LICENCAS_MODULO_REPOSITORIO, LicencaModulo, LicencasModuloRepositorioPort } from '../portas/licencas-modulo-repositorio.port';

const TITULO_MODELO_ATIVACAO = 'Ativação de Licença de Módulo (padrão do sistema)';
const TEMPLATE_MODELO_ATIVACAO =
  'Contrato de licenciamento de módulo entre {{EMPRESA_RAZAO_SOCIAL}} e {{CLIENTE_NOME}}.\n\nMódulo(s) licenciado(s): conforme pacote contratado.\nValor: {{VALOR_TOTAL}} em {{QUANTIDADE_PARCELAS}}x.\nData: {{DATA_HOJE}}.';

export interface DadosAtivarLicenca {
  licencaId: string;
  contadorId: string;
  empresaId: string; // empresa-cliente da carteira que vai receber o módulo
  valorCobrado: number | null; // null = ativação sem cobrança (contador decide não cobrar dessa vez)
  parcelamento: { modo: ModoParcelamento; quantidadeParcelas: number; primeiroVencimento: string; intervaloDias: number } | null;
  executadoPor: string; // usuário humano que clicou "ativar" -- vira criadoPor do contrato
}

/**
 * Ativar = 3 passos atômicos-o-suficiente pro caso de uso (se o contrato falhar, a
 * licença não fica marcada como ativa -- ver ordem abaixo):
 * 1. valida licença + posse da empresa-cliente na carteira do contador
 * 2. gera o contrato formal (contador -> empresa-cliente), que já cria o par
 *    receber(contador)/pagar(empresa) via CriarContratoUseCase quando há valorCobrado
 * 3. só then marca a licença como ativa (empresa_id + status=ativa)
 */
@Injectable()
export class AtivarLicencaUseCase {
  constructor(
    @Inject(LICENCAS_MODULO_REPOSITORIO) private readonly repositorio: LicencasModuloRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(PACOTES_MODULOS_REPOSITORIO) private readonly pacotesRepositorio: PacotesModulosRepositorioPort,
    @Inject(CONTRATOS_REPOSITORIO) private readonly contratosRepositorio: ContratosRepositorioPort,
    private readonly criarContrato: CriarContratoUseCase,
  ) {}

  async executar(dados: DadosAtivarLicenca): Promise<LicencaModulo> {
    const licenca = await this.repositorio.obterPorId(dados.licencaId);
    if (!licenca || licenca.contadorId !== dados.contadorId) {
      throw new NotFoundException('Licença não encontrada');
    }
    if (!podeAtivar(licenca.status)) {
      throw new BadRequestException(`Licença com status "${licenca.status}" não pode ser ativada`);
    }

    const pertence = await this.empresasRepositorio.pertenceAoContador(dados.empresaId, dados.contadorId);
    if (!pertence) {
      throw new NotFoundException('Empresa não encontrada na sua carteira');
    }

    const pacote = await this.pacotesRepositorio.obterPorId(licenca.pacoteId);
    if (!pacote) {
      throw new NotFoundException('Pacote da licença não encontrado');
    }
    if (pacoteExpirado(pacote.dataValidade)) {
      throw new BadRequestException('Pacote expirado -- não é possível ativar licença dele');
    }

    const empresaInterna = await this.empresasRepositorio.buscarEmpresaInternaDoContador(dados.contadorId);
    if (!empresaInterna) {
      throw new NotFoundException('Empresa interna do contador não encontrada -- contate o suporte');
    }

    // Caminho de cobrança real passou a ser IniciarPagamentoAtivacaoLicencaUseCase (split
    // PagBank) -- este usecase fica só pra ativação GRATUITA. Antes aceitava valorCobrado
    // livre e só lançava contábil (sem gateway nenhum movendo dinheiro de verdade).
    if (dados.valorCobrado != null && dados.valorCobrado > 0) {
      throw new BadRequestException(
        'Ativação com cobrança real passou a usar pagamento com split -- use "iniciar-pagamento" em vez de informar valorCobrado aqui',
      );
    }

    const modelo = await this.obterOuCriarModeloAtivacao(empresaInterna.id);

    await this.criarContrato.executar({
      empresaId: empresaInterna.id,
      modeloId: modelo.id,
      clienteId: null,
      empresaContraparteId: dados.empresaId,
      titulo: `Licença: ${pacote.nome}`,
      valoresTagsManuais: {},
      valorTotal: dados.valorCobrado,
      parcelamento: dados.parcelamento,
      criadoPor: dados.executadoPor,
    });

    await this.repositorio.ativar(dados.licencaId, dados.empresaId);
    return (await this.repositorio.obterPorId(dados.licencaId))!;
  }

  private async obterOuCriarModeloAtivacao(empresaInternaId: string) {
    const modelos = await this.contratosRepositorio.listarModelosPorEmpresa(empresaInternaId);
    const existente = modelos.find((m) => m.titulo === TITULO_MODELO_ATIVACAO);
    if (existente) return existente;

    return this.contratosRepositorio.criarModelo({
      empresaId: empresaInternaId,
      titulo: TITULO_MODELO_ATIVACAO,
      conteudoTemplate: TEMPLATE_MODELO_ATIVACAO,
      tipoConteudo: 'texto',
    });
  }
}
