import { Coluna } from '../aplicacao/portas/quadros-tarefas-repositorio.port';

/** Seed do 1º acesso de cada empresa -- editável depois, não é fixo. */
export const COLUNAS_PADRAO: Array<{ nome: string; ehFinal: boolean }> = [
  { nome: 'A Fazer', ehFinal: false },
  { nome: 'Em Andamento', ehFinal: false },
  { nome: 'Concluído', ehFinal: true },
];

/**
 * Pelo menos 1 coluna final tem que sobrar sempre -- senão nenhuma tarefa deste quadro
 * nunca dispara o bumerangue pro criador. Usado tanto ao excluir uma coluna final quanto
 * ao desmarcar `ehFinal` da última que restava.
 */
export function validarPermaneceColunaFinal(colunas: Coluna[], idRemovida: string): void {
  const restantes = colunas.filter((coluna) => coluna.id !== idRemovida);
  if (!restantes.some((coluna) => coluna.ehFinal)) {
    throw new Error('O quadro precisa de pelo menos 1 coluna final (bumerangue) depois dessa alteração');
  }
}
