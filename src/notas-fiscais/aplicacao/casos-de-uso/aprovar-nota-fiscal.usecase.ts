import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { ParcelaGerada } from '../../../contas-a-pagar/dominio/conta-pagar';
import { CriarContaPagarUseCase } from '../../../contas-a-pagar/aplicacao/casos-de-uso/criar-conta-pagar.usecase';
import { CriarContaReceberUseCase } from '../../../contas-a-receber/aplicacao/casos-de-uso/criar-conta-receber.usecase';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../../../lancamentos-contabeis/aplicacao/portas/lancamentos-repositorio.port';
import { NotaFiscalDetalhe, PagamentoNotaFiscalPersistido } from '../portas/notas-fiscais-repositorio.port';
import { NOTAS_FISCAIS_REPOSITORIO, NotasFiscaisRepositorioPort } from '../portas/notas-fiscais-repositorio.port';

/** tPag do manual NFe 4.0 -- só dinheiro físico é certeza imediata, sem nada a conciliar depois. */
const FORMA_PAGAMENTO_DINHEIRO = '01';

/**
 * Nota só dispara baixa automática quando TODO o pagamento (pode ter mais de 1 detPag em
 * pagamento combinado) é dinheiro -- qualquer PIX/cartão/transferência no meio cancela a
 * baixa automática inteira (nunca baixa só a fração em dinheiro, a parcela única da conta
 * a receber é todo-ou-nada). PIX/transferência exigem conciliação bancária real (módulo
 * conciliacao-bancaria) antes de contar como recebido -- nunca presumir que caiu.
 *
 * indPag é só desqualificante quando vem '1' (a prazo) ou '2' (outros) -- NUNCA quando
 * null/ausente. Confirmado em XML real de NFCe (SEFAZ-PA, ERP LCV3.2.0): `<detPag>` sem
 * `indPag` nenhum, mesmo sendo venda de balcão 100% dinheiro -- indPag é campo opcional no
 * layout 4.00, muitos emissores de PDV simplesmente omitem. Exigir '0' explícito bloquearia
 * a baixa automática até no caso mais comum (NFCe de mercadinho) que essa feature existe
 * pra resolver.
 */
function ehPagamentoIntegralDinheiro(pagamentos: PagamentoNotaFiscalPersistido[]): boolean {
  if (pagamentos.length === 0) return false;
  return pagamentos.every((p) => p.indicadorPagamento !== '1' && p.indicadorPagamento !== '2' && p.formaPagamento === FORMA_PAGAMENTO_DINHEIRO);
}

/** nDup às vezes vem como "001"/"002" -- extrai o número; se não for numérico (XML fora do padrão), cai pra posição sequencial, nunca quebra a aprovação por isso. */
function numeroDaParcela(numeroDuplicata: string, posicao: number): number {
  const numero = parseInt(numeroDuplicata, 10);
  return Number.isFinite(numero) && numero > 0 ? numero : posicao + 1;
}

/**
 * Único lugar que transforma uma nota 'capturada' em lançamento contábil de verdade --
 * nunca acontece sozinho na ingestão (IngerirNotaFiscalUseCase), sempre depende de revisão
 * humana explícita. Reaproveita CriarContaPagarUseCase/CriarContaReceberUseCase tal como
 * já existem (já criam conta+parcelas+lançamento em partida dobrada) com o modo
 * 'explicito' de parcelamento quando a nota tem duplicata real (cobr/dup).
 *
 * Saída sem duplicata (NFCe) tem 2 caminhos BEM diferentes, decididos aqui:
 * - 100% dinheiro à vista + conta de baixa configurada: NUNCA cria conta a receber --
 *   lança direto D Caixa/Banco / C Receita (1 lançamento só, origem 'notas_fiscais').
 *   Decisão do usuário: venda à vista não é "a receber", aparecer lá confundia (parecia
 *   venda a prazo mesmo marcada "Recebida").
 * - qualquer outro caso (cartão/PIX/transferência, sem config, ou pagamento não capturado):
 *   cai no fluxo normal de CriarContaReceberUseCase, fica "Aberta" pra baixa manual ou
 *   conciliação bancária depois -- nunca presumir recebido sem confirmação real.
 */
@Injectable()
export class AprovarNotaFiscalUseCase {
  constructor(
    @Inject(NOTAS_FISCAIS_REPOSITORIO) private readonly repositorio: NotasFiscaisRepositorioPort,
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly lancamentos: LancamentosRepositorioPort,
    private readonly criarContaPagar: CriarContaPagarUseCase,
    private readonly criarContaReceber: CriarContaReceberUseCase,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, aprovadoPor: string): Promise<{ contaPagarId: string | null; contaReceberId: string | null }> {
    const nota = await this.repositorio.obterDetalhe(id, empresaId);
    if (!nota) throw new NotFoundException('Nota fiscal não encontrada');
    if (nota.status !== 'capturada') {
      throw new BadRequestException(`Nota já está "${nota.status}" -- só nota "capturada" pode ser aprovada`);
    }

    const config = await this.repositorio.buscarConfiguracaoLancamentos(empresaId);
    if (!config) {
      throw new BadRequestException('Configure as contas do lançamento automático de notas fiscais antes de aprovar (empresas/{id}/notas-fiscais/configuracao-lancamentos).');
    }

    const dataEmissao = nota.dataEmissao.slice(0, 10);
    const parcelasExplicitas: ParcelaGerada[] = nota.parcelas.map((parcela, indice) => ({
      numeroParcela: numeroDaParcela(parcela.numeroDuplicata, indice),
      valorParcela: parcela.valor,
      dataVencimento: parcela.dataVencimento,
    }));
    const temDuplicata = parcelasExplicitas.length > 0;

    let contaPagarId: string | null = null;
    let contaReceberId: string | null = null;

    if (nota.direcao === 'entrada') {
      contaPagarId = await this.criarContaPagar.executar({
        empresaId,
        fornecedorId: nota.fornecedorId,
        fornecedor: nota.emitenteNome,
        descricao: this.descricao(nota),
        contaPatrimonialId: config.contaPatrimonialEntradaId,
        contaResultadoId: config.contaResultadoEntradaId,
        dataEmissao,
        criadoPor: aprovadoPor,
        modo: temDuplicata ? 'explicito' : 'unico',
        valor: nota.valorTotal,
        quantidadeParcelas: temDuplicata ? parcelasExplicitas.length : 1,
        primeiroVencimento: temDuplicata ? parcelasExplicitas[0].dataVencimento : dataEmissao,
        intervaloDias: 0,
        parcelasExplicitas: temDuplicata ? parcelasExplicitas : undefined,
      });
    } else if (!temDuplicata && config.contaRecebimentoVistaId && ehPagamentoIntegralDinheiro(nota.pagamentos)) {
      await this.lancamentos.criar({
        empresaId,
        dataCompetencia: dataEmissao,
        historico: `Recebimento à vista (dinheiro): ${this.descricao(nota)}`,
        documentoReferencia: nota.id,
        origem: 'notas_fiscais',
        partidas: [
          { contaId: config.contaRecebimentoVistaId, tipo: 'debito', valor: nota.valorTotal },
          { contaId: config.contaResultadoSaidaId, tipo: 'credito', valor: nota.valorTotal },
        ],
        criadoPor: aprovadoPor,
      });
    } else {
      contaReceberId = await this.criarContaReceber.executar({
        empresaId,
        clienteId: nota.clienteId,
        clienteNome: nota.destinatarioNome ?? 'Consumidor final',
        descricao: this.descricao(nota),
        contaPatrimonialId: config.contaPatrimonialSaidaId,
        contaResultadoId: config.contaResultadoSaidaId,
        dataEmissao,
        criadoPor: aprovadoPor,
        modo: temDuplicata ? 'explicito' : 'unico',
        valor: nota.valorTotal,
        quantidadeParcelas: temDuplicata ? parcelasExplicitas.length : 1,
        primeiroVencimento: temDuplicata ? parcelasExplicitas[0].dataVencimento : dataEmissao,
        intervaloDias: 0,
        parcelasExplicitas: temDuplicata ? parcelasExplicitas : undefined,
      });
    }

    await this.repositorio.marcarAprovada(id, aprovadoPor, contaPagarId, contaReceberId);

    await this.auditoria.registrar({
      usuarioId: aprovadoPor,
      empresaId,
      acao: 'APROVAR_NOTA_FISCAL',
      recurso: `notas_fiscais:${id}`,
      dadosNovos: { contaPagarId, contaReceberId },
    });

    return { contaPagarId, contaReceberId };
  }

  private descricao(nota: NotaFiscalDetalhe): string {
    const contraparte = nota.direcao === 'entrada' ? nota.emitenteNome : nota.destinatarioNome ?? 'Consumidor final';
    return `NF${nota.modelo === '65' ? 'Ce' : 'e'} nº${nota.numero}/${nota.serie} -- ${contraparte}`;
  }
}
