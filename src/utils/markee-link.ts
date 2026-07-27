/**
 * Formato dos códigos que circulam no app (QR e texto colado).
 *
 * O QR guarda uma URL do esquema `markee://`, não só o código solto: assim,
 * quem lê o código com a câmera do sistema é levado para o app, e quem lê
 * dentro do Markee cai direto na tela certa. O código sozinho também é aceito,
 * porque é o que a pessoa consegue ditar por voz ou colar de uma conversa.
 */

export type MarkeeCode =
  | { kind: 'profile'; code: string }
  | { kind: 'group'; code: string };

/*
 * O caminho é `/add/...` e não `/u/...` de propósito: a rota `/u/[id]` espera o
 * UUID da conta, e quem lesse o QR com a câmera do sistema cairia lá com um
 * código de 8 caracteres, abrindo uma tela quebrada. `/add` tem rota própria,
 * que resolve o código antes de navegar.
 */
export function profileLink(friendCode: string): string {
  return `markee://add/u/${friendCode}`;
}

export function groupLink(joinCode: string): string {
  return `markee://add/g/${joinCode}`;
}

/** Códigos são 8 caracteres hexadecimais (4 bytes de gen_random_bytes). */
const RAW_CODE = /^[0-9a-f]{8}$/i;

/**
 * Entende as três formas que o mesmo código pode chegar: link do app, link
 * https e código digitado. Devolve null se não reconhecer — nunca adivinha.
 */
export function parseMarkeeCode(input: string, fallback: MarkeeCode['kind'] = 'profile'): MarkeeCode | null {
  const value = input.trim();

  const link = value.match(/^(?:markee:\/\/|https?:\/\/[^/]+\/)(?:add\/)?([ug])\/([0-9a-f]{8})/i);
  if (link) {
    return { kind: link[1].toLowerCase() === 'g' ? 'group' : 'profile', code: link[2].toLowerCase() };
  }

  if (RAW_CODE.test(value)) {
    return { kind: fallback, code: value.toLowerCase() };
  }

  return null;
}

/** Agrupa em pares para ler em voz alta: `47f7 a518`. */
export function prettyCode(code: string): string {
  return code.replace(/(.{4})(.{4})/, '$1 $2').toUpperCase();
}
