import { Inject, Injectable } from '@nestjs/common';
import { Papel, validarCoerenciaEscopo } from '../../dominio/papel';
import {
  USUARIOS_REPOSITORIO,
  UsuariosRepositorioPort,
} from '../portas/usuarios-repositorio.port';
import {
  PROVEDOR_IDENTIDADE,
  ProvedorIdentidadePort,
} from '../portas/provedor-identidade.port';

export interface EntradaAtualizarPapel {
  usuarioId: string;
  novoPapel: Papel;
  novoContadorId: string | null;
  novoEmpresaId: string | null;
}

@Injectable()
export class AtualizarPapelUsuarioUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(PROVEDOR_IDENTIDADE) private readonly provedorIdentidade: ProvedorIdentidadePort,
  ) {}

  async executar(entrada: EntradaAtualizarPapel): Promise<void> {
    // Rota é SUPER_ADMIN-only hoje (ator sempre de escopo plataforma) -- resolve só papel
    // global. Vira contextual quando o TODO de permitir CONTADOR_DONO nessa rota (ver
    // auth.controller.ts) for implementado.
    const infoPapel = await this.usuariosRepositorio.buscarPapelPorNome(entrada.novoPapel, { contadorId: null, empresaId: null });
    validarCoerenciaEscopo(infoPapel.escopo, entrada.novoContadorId, entrada.novoEmpresaId);

    // Preferência de 2FA é do usuário, não do papel -- nunca resetar ao trocar papel/vínculo.
    const usuarioAtual = await this.usuariosRepositorio.buscarPorId(entrada.usuarioId);

    // Banco primeiro: se falhar aqui, os claims antigos continuam consistentes com o
    // perfil antigo -- não há intervalo onde o app_metadata mente sobre o perfil real.
    await this.usuariosRepositorio.atualizarPapelEVinculo(
      entrada.usuarioId,
      infoPapel.id,
      entrada.novoContadorId,
      entrada.novoEmpresaId,
    );

    // Crítico: sem isso, o RLS continua filtrando pelo papel/vínculo ANTIGO até o
    // usuário forçar um novo login (docs/BANCO_DE_DADOS.md §1).
    await this.provedorIdentidade.sincronizarClaims(entrada.usuarioId, {
      papel: entrada.novoPapel,
      escopo: infoPapel.escopo,
      nuncaRestringe: infoPapel.nuncaRestringe,
      contadorId: entrada.novoContadorId,
      empresaId: entrada.novoEmpresaId,
      metodo2fa: usuarioAtual?.metodo2fa ?? 'nenhum',
    });
  }
}
