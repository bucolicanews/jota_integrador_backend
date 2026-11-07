import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ASSINATURAS_REPOSITORIO, AssinaturasRepositorioPort } from '../../../assinaturas/aplicacao/portas/assinaturas-repositorio.port';
import { PLANOS_REPOSITORIO, PlanosRepositorioPort } from '../../../planos/aplicacao/portas/planos-repositorio.port';
import { papelExigeChecagemGranular } from '../../dominio/permissao';
import { Papel, validarCoerenciaEscopo } from '../../dominio/papel';
import {
  PERMISSOES_REPOSITORIO,
  PermissoesRepositorioPort,
} from '../portas/permissoes-repositorio.port';
import {
  USUARIOS_REPOSITORIO,
  Usuario,
  UsuariosRepositorioPort,
} from '../portas/usuarios-repositorio.port';
import {
  PROVEDOR_IDENTIDADE,
  ProvedorIdentidadePort,
} from '../portas/provedor-identidade.port';

export interface EntradaCriarUsuario {
  nome: string;
  email: string;
  papel: Papel;
  contadorId: string | null;
  empresaId: string | null;
}

export interface ResultadoCriarUsuario extends Usuario {
  /**
   * Link de acesso pronto pra copiar/enviar (WhatsApp, e-mail manual) -- não depende de
   * SMTP estar configurado, ao contrário do convite automático disparado por
   * `criarUsuarioComConvite`. Sempre presente: o e-mail automático é melhor-esforço, o
   * link é a garantia real de que o cliente consegue entrar.
   */
  linkAcesso: string;
}

@Injectable()
export class CriarUsuarioUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(PROVEDOR_IDENTIDADE) private readonly provedorIdentidade: ProvedorIdentidadePort,
    @Inject(PERMISSOES_REPOSITORIO) private readonly permissoesRepositorio: PermissoesRepositorioPort,
    @Inject(ASSINATURAS_REPOSITORIO) private readonly assinaturasRepositorio: AssinaturasRepositorioPort,
    @Inject(PLANOS_REPOSITORIO) private readonly planosRepositorio: PlanosRepositorioPort,
  ) {}

  async executar(entrada: EntradaCriarUsuario): Promise<ResultadoCriarUsuario> {
    validarCoerenciaEscopo(entrada.papel, entrada.contadorId, entrada.empresaId);

    // 1. Identidade primeiro (provedor de auth) -- o id gerado lá é o mesmo usado no perfil.
    const { id, jaExistiaNoProvedor } = await this.provedorIdentidade.criarUsuarioComConvite(entrada.email);

    if (jaExistiaNoProvedor) {
      // E-mail já tem identidade no provedor. Só é seguro reaproveitar o id se NINGUÉM
      // já usa esse e-mail como perfil de domínio (senão estaríamos roubando o acesso de
      // outro contador/empresa, sobrescrevendo os claims dele). Perfil inexistente =
      // identidade órfã de uma tentativa anterior que não terminou (convite aceito, mas
      // esse usecase falhou no meio antes do passo 3) -- aí sim pode continuar normal.
      const perfilExistente = await this.usuariosRepositorio.buscarPorEmail(entrada.email);
      if (perfilExistente) {
        throw new ConflictException(
          `O e-mail ${entrada.email} já está em uso por outro usuário (papel ${perfilExistente.papel}). Use um e-mail diferente para este cadastro.`,
        );
      }
    }

    // 2. Sincroniza claims ANTES do perfil existir -- se falhar aqui, não sobra usuário
    //    "manco" (perfil sem claims, que quebraria RLS pra ele depois).
    await this.provedorIdentidade.sincronizarClaims(id, {
      papel: entrada.papel,
      contadorId: entrada.contadorId,
      empresaId: entrada.empresaId,
    });

    // 3. Perfil de domínio.
    const papelId = await this.usuariosRepositorio.buscarIdPapelPorNome(entrada.papel);
    const usuario = await this.usuariosRepositorio.criar({
      id,
      nome: entrada.nome,
      email: entrada.email,
      papelId,
      contadorId: entrada.contadorId,
      empresaId: entrada.empresaId,
    });

    // 4. Suporte é concedido por padrão pra todo papel restringível (OPERADOR_CONTADOR/
    //    OPERADOR_EMPRESA/ADMIN_FINANCEIRO/ADMIN_SUPORTE) -- sem isso, um recém-criado sem
    //    nenhuma concessão fica só com Painel no menu, sem nem conseguir abrir um ticket.
    //    `concedido_por` aponta pro próprio usuário (concessão automática de sistema, não
    //    ação de um admin de verdade).
    if (papelExigeChecagemGranular(entrada.papel)) {
      const catalogo = await this.permissoesRepositorio.listarCatalogoPermissoes();
      const chavesPadrao = new Set(['suporte:visualizar']);

      // OPERADOR_EMPRESA também herda o que o PLANO da empresa define como padrão (ver
      // "Editar plano" > permissões incluídas) -- só aplicado aqui na criação, nunca
      // retroativo pra quem já existe. Falha silenciosa se a empresa não tiver assinatura
      // ativa ainda (ex: convite enviado antes de ativar o plano) -- não é motivo pra
      // travar a criação do login.
      if (entrada.papel === Papel.OPERADOR_EMPRESA && entrada.empresaId) {
        const assinatura = await this.assinaturasRepositorio.buscarAtivaPorEmpresa(entrada.empresaId);
        if (assinatura) {
          const plano = await this.planosRepositorio.buscarPorId(assinatura.planoId);
          plano?.permissoesPadrao.forEach((chave) => chavesPadrao.add(chave));
        }
      }

      for (const chave of chavesPadrao) {
        const permissao = catalogo.find((p) => p.chave === chave);
        if (permissao) {
          await this.permissoesRepositorio.conceder(usuario.id, permissao.id, usuario.id);
        }
      }
    }

    // 5. Link de acesso -- gerado DEPOIS do usuário já existir no provedor (passo 1).
    const linkAcesso = await this.provedorIdentidade.gerarLinkAcesso(entrada.email);

    return { ...usuario, linkAcesso };
  }
}
