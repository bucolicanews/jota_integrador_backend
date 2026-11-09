import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifica a assinatura HTTP dos Auth Hooks do Supabase -- segue o padrão Standard
 * Webhooks (mesmo usado por Svix/Stripe): `webhook-signature` é HMAC-SHA256 em base64
 * de `{id}.{timestamp}.{corpo_cru}`, usando a chave do segredo configurado no painel do
 * Supabase (formato `v1,whsec_<base64>` -- só a parte depois de `whsec_` é a chave).
 * Precisa do corpo CRU (Buffer), nunca do objeto já parseado pelo ValidationPipe -- ver
 * main.ts (mesmo motivo do webhook do Stripe no DeliveryHub: assinatura quebra se o
 * corpo já foi reserializado).
 */
export function verificarAssinaturaWebhookSupabase(
  corpoCru: Buffer,
  cabecalhos: { 'webhook-id'?: string; 'webhook-timestamp'?: string; 'webhook-signature'?: string },
  segredo: string,
): boolean {
  const id = cabecalhos['webhook-id'];
  const timestamp = cabecalhos['webhook-timestamp'];
  const assinaturaRecebida = cabecalhos['webhook-signature'];
  if (!id || !timestamp || !assinaturaRecebida) return false;

  // Segredo vem como "v1,whsec_XXXX" ou só "whsec_XXXX" -- a chave real é o base64 depois do prefixo.
  const chaveBase64 = segredo.replace(/^v1,/, '').replace(/^whsec_/, '');
  const chave = Buffer.from(chaveBase64, 'base64');

  const conteudoAssinado = `${id}.${timestamp}.${corpoCru.toString('utf8')}`;
  const assinaturaEsperada = createHmac('sha256', chave).update(conteudoAssinado).digest('base64');

  // `webhook-signature` pode trazer mais de uma assinatura espaço-separada (rotação de
  // chave) -- basta UMA bater. Cada entrada vem como "v1,<base64>".
  return assinaturaRecebida.split(' ').some((entrada) => {
    const [, valor] = entrada.split(',');
    if (!valor) return false;
    const bufEsperado = Buffer.from(assinaturaEsperada, 'base64');
    const bufRecebido = Buffer.from(valor, 'base64');
    return bufEsperado.length === bufRecebido.length && timingSafeEqual(bufEsperado, bufRecebido);
  });
}
