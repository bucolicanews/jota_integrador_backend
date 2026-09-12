import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../../../contratos/aplicacao/portas/contratos-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { validarCpfOuCnpj } from '../../dominio/contador';
import {
  CONTADORES_REPOSITORIO,
  Contador,
  ContadoresRepositorioPort,
  DadosNovoContador,
} from '../portas/contadores-repositorio.port';

// Plano de contas mínimo de toda empresa interna (contador ou plataforma) -- o suficiente
// pra emitir_cobranca_interna ter uma conta de cada grupo necessário (Ativo a receber,
// Passivo a pagar, Receita, Despesa). Mesmos códigos usados no seed da empresa da Jota
// (migration 20260912000002).
const PLANO_CONTAS_EMPRESA_INTERNA = [
  { codigo: '1.1', nome: 'Contas a Receber', grupo: 'ativo' as const },
  { codigo: '2.1', nome: 'Contas a Pagar', grupo: 'passivo' as const },
  { codigo: '3.1', nome: 'Receita de Módulos e Assinaturas', grupo: 'receita' as const },
  { codigo: '4.1', nome: 'Despesas com Licenças e Honorários', grupo: 'despesa' as const },
];

@Injectable()
export class CriarContadorUseCase {
  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContasRepositorio: PlanoContasRepositorioPort,
    @Inject(CONTRATOS_REPOSITORIO) private readonly contratosRepositorio: ContratosRepositorioPort,
  ) {}

  // `tipo='interno_jota'` (fallback pra empresa sem contador humano, e dono da empresa
  // interna_plataforma) não passa por aqui -- é infraestrutura de seed (migration
  // 20260912000002), não um fluxo de criação via API. Todo contador criado por este caso
  // de uso é `humano`.
  async executar(entrada: DadosNovoContador): Promise<Contador> {
    if (!validarCpfOuCnpj(entrada.cnpjCpf)) {
      throw new BadRequestException('CPF/CNPJ inválido');
    }

    const contador = await this.contadoresRepositorio.criar(entrada);

    // Toda contador ganha a própria "empresa" (tipo='interna_contador') pra controlar o
    // próprio negócio -- reaproveita 100% o mesmo plano de contas/lançamentos/CP-CR já
    // construído pra empresa-cliente, só marcado como não-cliente (nunca aparece na
    // carteira, sempre liberado do módulo de licenciamento -- ver empresa_tem_modulo).
    const empresaInterna = await this.empresasRepositorio.criar({
      contadorId: contador.id,
      tipo: 'interna_contador',
      razaoSocial: contador.nome,
      nomeFantasia: null,
      cnpj: contador.cnpjCpf,
      regimeTributario: null,
      modoAcessoSerpro: 'procuracao', // irrelevante pra empresa interna -- nunca consulta SERPRO
    });

    const contasCriadas: Record<string, string> = {};
    for (const conta of PLANO_CONTAS_EMPRESA_INTERNA) {
      const criada = await this.planoContasRepositorio.criar({
        empresaId: empresaInterna.id,
        codigo: conta.codigo,
        nome: conta.nome,
        grupo: conta.grupo,
        sintetica: false,
        contaPaiId: null,
        contaCaixaBanco: false,
        contaAReceber: conta.codigo === '1.1',
        contaAPagar: conta.codigo === '2.1',
      });
      contasCriadas[conta.codigo] = criada.id;
    }

    // Configuração de contratos (credor + devedor) já pronta pra empresa interna --
    // sem isso, gerar/receber uma cobrança interna (emitir_cobranca_interna) pediria
    // configuração manual antes de qualquer contrato funcionar.
    await this.contratosRepositorio.salvarConfiguracao(empresaInterna.id, {
      contaPatrimonialReceberId: contasCriadas['1.1'],
      contaResultadoReceitaId: contasCriadas['3.1'],
      contaPatrimonialPagarId: contasCriadas['2.1'],
      contaResultadoDespesaId: contasCriadas['4.1'],
    });

    return contador;
  }
}
