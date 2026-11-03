import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Papel, validarCoerenciaEscopo } from '../../dominio/papel';
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

    // 4. Link de acesso -- gerado DEPOIS do usuário já existir no provedor (passo 1).
    const linkAcesso = await this.provedorIdentidade.gerarLinkAcesso(entrada.email);

    return { ...usuario, linkAcesso };
  }
}
