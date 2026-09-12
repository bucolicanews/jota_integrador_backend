/**
 * Engine de tags {{TAG}} compartilhada entre contratos/ e documentos-societarios/ --
 * função pura, sem estado, sem dependência de nenhum dos dois módulos. Reaproveitar uma
 * função utilitária pura não contradiz a decisão de módulos separados (schema/usecases
 * de negócio continuam independentes).
 *
 * Substituição literal, sem interpretação de expressão -- valores não encontrados em
 * `valores` mantêm a tag original no texto (mais seguro que apagar silenciosamente um
 * campo não preenchido, o usuário vê que faltou preencher algo).
 */
export function renderizarTags(template: string, valores: Record<string, string>): string {
  return template.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (correspondencia, nomeTag: string) => {
    const valor = valores[nomeTag];
    return valor !== undefined ? valor : correspondencia;
  });
}

/** Lista as tags {{TAG}} presentes num template, na ordem em que aparecem, sem duplicatas. */
export function extrairTagsDoTemplate(template: string): string[] {
  const encontradas = new Set<string>();
  const regex = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;
  let correspondencia: RegExpExecArray | null;
  while ((correspondencia = regex.exec(template)) !== null) {
    encontradas.add(correspondencia[1]);
  }
  return [...encontradas];
}
