const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

/** Host do nosso storage — só imagens daqui são carregadas. */
const ALLOWED_IMAGE_ORIGIN = SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/` : '';

/**
 * Carregar uma imagem faz o aparelho abrir conexão com quem a hospeda, o que
 * entrega IP, horário e user-agent. É assim que funcionam os "grabbers" de link
 * e os pixels de rastreamento. Por isso só renderizamos imagens que estão no
 * nosso próprio storage; qualquer outra vira link comum, que o usuário abre se
 * quiser — aí a decisão é consciente e sai no navegador, não no app.
 */
export function isSelfHostedImage(url: string): boolean {
  if (!ALLOWED_IMAGE_ORIGIN) return false;
  return url.startsWith(ALLOWED_IMAGE_ORIGIN);
}

const SAFE_LINK_SCHEMES = ['https:', 'http:', 'mailto:', 'tel:'];

/**
 * Bloqueia esquemas que executam código ou abrem coisas indevidas
 * (javascript:, data:, file:, intent: ...). Sem isso, um link colado numa nota
 * compartilhada poderia disparar comportamento inesperado ao ser tocado.
 */
export function isSafeLink(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return false;

  const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*:)/);
  if (!schemeMatch) return false;

  return SAFE_LINK_SCHEMES.includes(schemeMatch[1]);
}

/** Domínio legível, para mostrar ao usuário antes de ele decidir abrir. */
export function displayHost(url: string): string {
  const match = url.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i);
  return match ? match[1] : url;
}
