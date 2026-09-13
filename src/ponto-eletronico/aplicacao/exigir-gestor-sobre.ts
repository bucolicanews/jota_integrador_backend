import { ForbiddenException } from '@nestjs/common';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { Usuario } from '../../auth/aplicacao/portas/usuarios-repositorio.port';
import { EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';

/**
 * Compartilhado por todo caso de uso de gestão (falta/abono, folga trabalhada, ajuste,
 * férias, configuração, listagem). Um CONTADOR_DONO nunca tem `empresaId` preenchido (só
 * `contadorId`) -- comparar `usuarioAtual.empresaId === funcionario.empresaId` pra um
 * OPERADOR_EMPRESA de uma empresa da carteira sempre falha (os dois lados nunca batem).
 * Por isso, funcionário de escopo empresa exige checar se a empresa dele PERTENCE À
 * CARTEIRA do contador (via EmpresasRepositorioPort), não uma comparação direta de campo.
 */
export async function exigirGestorSobre(
  usuarioAtual: UsuarioAutenticado,
  funcionario: Usuario,
  empresasRepositorio: EmpresasRepositorioPort,
): Promise<void> {
  if (usuarioAtual.papel === Papel.SUPER_ADMIN) return;

  if (usuarioAtual.papel !== Papel.CONTADOR_DONO && usuarioAtual.papel !== Papel.EMPRESARIO_DONO) {
    throw new ForbiddenException('Só o gestor do funcionário pode gerenciar o ponto dele');
  }

  // Funcionário de escopo contador (OPERADOR_CONTADOR) -- gestor é o CONTADOR_DONO do mesmo escritório.
  if (funcionario.contadorId !== null) {
    if (usuarioAtual.contadorId === funcionario.contadorId) return;
    throw new ForbiddenException('Sem autoridade sobre este funcionário');
  }

  // Funcionário de escopo empresa (OPERADOR_EMPRESA) -- gestor é o EMPRESARIO_DONO da
  // própria empresa, ou o CONTADOR_DONO cuja carteira inclui essa empresa.
  if (funcionario.empresaId !== null) {
    if (usuarioAtual.empresaId === funcionario.empresaId) return;
    if (usuarioAtual.papel === Papel.CONTADOR_DONO && usuarioAtual.contadorId) {
      const pertenceACarteira = await empresasRepositorio.pertenceAoContador(funcionario.empresaId, usuarioAtual.contadorId);
      if (pertenceACarteira) return;
    }
  }

  throw new ForbiddenException('Sem autoridade sobre este funcionário');
}
