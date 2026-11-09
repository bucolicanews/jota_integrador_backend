import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ASSINATURAS_REPOSITORIO, AssinaturasRepositorioPort } from '../../../assinaturas/aplicacao/portas/assinaturas-repositorio.port';
import { PLANOS_REPOSITORIO, PlanosRepositorioPort } from '../../../planos/aplicacao/portas/planos-repositorio.port';
import { papelExigeChecagemGranular } from '../../dominio/permissao';
import { InfoPapel, validarCoerenciaEscopo } from '../../dominio/papel';
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
  /**
   * Já resolvido por quem chama (controller, via `buscarPapelPorNome` escopado ao ATOR) --
   * evita repetir uma busca por nome que seria ambígua aqui dentro (papel não é mais
   * único global desde que CONTADOR_DONO/EMPRESARIO_DONO criam o próprio).
   */
  infoPapel: InfoPapel;
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
    const { infoPapel } = entrada;
    validarCoerenciaEscopo(infoPapel.escopo, entrada.contadorId, entrada.empresaId);

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
      papel: infoPapel.nome,
      escopo: infoPapel.escopo,
      nuncaRestringe: infoPapel.nuncaRestringe,
      contadorId: entrada.contadorId,
      empresaId: entrada.empresaId,
      metodo2fa: 'nenhum',
    });

    // 3. Perfil de domínio.
    const usuario = await this.usuariosRepositorio.criar({
      id,
      nome: entrada.nome,
      email: entrada.email,
      papelId: infoPapel.id,
      contadorId: entrada.contadorId,
      empresaId: entrada.empresaId,
    });

    // 4. Teto do papel (papel_permissoes, template configurado em /admin/papeis) é
    //    concedido por padrão pra todo papel restringível -- sem isso, um recém-criado
    //    sem nenhuma concessão fica só com Painel no menu, sem nem conseguir abrir um
    //    ticket. `concedido_por` aponta pro próprio usuário (concessão automática de
    //    sistema, não ação de um admin de verdade).
    if (papelExigeChecagemGranular(infoPapel.nuncaRestringe)) {
      const teto = await this.permissoesRepositorio.obterTetoEfetivo(infoPapel.id, entrada.contadorId, entrada.empresaId);
      const permissoesAConceder = new Map(teto.map((permissao) => [permissao.chave, permissao.id]));

      // Todo funcionário de escopo empresa (OPERADOR_EMPRESA de sistema OU papel
      // customizado que a própria EMPRESARIO_DONO criou) também herda o que o PLANO da
      // empresa define como padrão (ver "Editar plano" > permissões incluídas), em cima
      // do teto do papel -- só aplicado aqui na criação, nunca retroativo pra quem já
      // existe. Falha silenciosa se a empresa não tiver assinatura ativa ainda (ex:
      // convite enviado antes de ativar o plano) -- não é motivo pra travar o login.
      if (infoPapel.escopo === 'empresa' && entrada.empresaId) {
        const assinatura = await this.assinaturasRepositorio.buscarAtivaPorEmpresa(entrada.empresaId);
        if (assinatura) {
          const plano = await this.planosRepositorio.buscarPorId(assinatura.planoId);
          if (plano && plano.permissoesPadrao.length > 0) {
            const catalogo = await this.permissoesRepositorio.listarCatalogoPermissoes();
            for (const chave of plano.permissoesPadrao) {
              const permissao = catalogo.find((p) => p.chave === chave);
              if (permissao) permissoesAConceder.set(chave, permissao.id);
            }
          }
        }
      }

      for (const permissaoId of permissoesAConceder.values()) {
        await this.permissoesRepositorio.conceder(usuario.id, permissaoId, usuario.id);
      }
    }

    // 5. Link de acesso -- gerado DEPOIS do usuário já existir no provedor (passo 1).
    const linkAcesso = await this.provedorIdentidade.gerarLinkAcesso(entrada.email);

    return { ...usuario, linkAcesso };
  }
}
