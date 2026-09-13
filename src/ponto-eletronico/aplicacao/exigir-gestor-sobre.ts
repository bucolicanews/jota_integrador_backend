import { ForbiddenException } from '@nestjs/common';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { Usuario } from '../../auth/aplicacao/portas/usuarios-repositorio.port';

/** Compartilhado por todo caso de uso de gestão (falta/abono, folga trabalhada, ajuste, férias, configuração) -- só o dono do escritório/empresa do funcionário (ou plataforma) pode gerenciar. */
export function exigirGestorSobre(usuarioAtual: UsuarioAutenticado, funcionario: Usuario): void {
  if (usuarioAtual.papel === Papel.SUPER_ADMIN) return;

  if (usuarioAtual.papel !== Papel.CONTADOR_DONO && usuarioAtual.papel !== Papel.EMPRESARIO_DONO) {
    throw new ForbiddenException('Só o gestor do funcionário pode gerenciar o ponto dele');
  }

  const mesmoContador = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === funcionario.contadorId;
  const mesmaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === funcionario.empresaId;
  if (!mesmoContador && !mesmaEmpresa) {
    throw new ForbiddenException('Sem autoridade sobre este funcionário');
  }
}
