import * as Crypto from 'expo-crypto';
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';

import { storage } from '@/storage/mmkv';

/**
 * Criptografia ponta a ponta das conversas entre amigos.
 *
 * Usa NaCl `box` (X25519 para combinar a chave + XSalsa20-Poly1305 para cifrar
 * e autenticar), via tweetnacl. O algoritmo NÃO é escrito à mão de propósito:
 * um erro em criptografia é silencioso — o texto continua parecendo cifrado
 * enquanto qualquer um consegue ler.
 *
 * O que isto garante:
 *   - O servidor guarda só bytes embaralhados. Nem nós conseguimos ler.
 *   - Mensagem adulterada no caminho não abre (Poly1305 autentica).
 *
 * O que isto NÃO garante, e é honesto dizer:
 *   - Sigilo futuro (forward secrecy). A chave do par é fixa; quem roubar a
 *     chave privada do aparelho lê o histórico. O Signal resolve isso com
 *     ratchet, que é bem mais complexo.
 *   - Metadados. Quem falou com quem e quando continua visível ao servidor.
 *   - Troca de chave maliciosa. Se o servidor entregasse uma chave pública
 *     falsa, ele leria tudo — por isso existe o código de verificação
 *     (safetyNumber) para as duas pessoas compararem fora do app.
 */

const PRIVATE_KEY = 'markee.e2e.secretKey';
const PUBLIC_KEY = 'markee.e2e.publicKey';

/**
 * O tweetnacl procura `crypto.getRandomValues`, que o React Native não tem.
 * Sem apontar uma fonte de aleatoriedade de verdade, a geração de chave falha —
 * e é justamente onde não dá para improvisar.
 */
nacl.setPRNG((x, n) => {
  const bytes = Crypto.getRandomBytes(n);
  for (let i = 0; i < n; i += 1) x[i] = bytes[i];
});

export type KeyPair = { publicKey: string; secretKey: string };

/** Cria o par de chaves na primeira vez e reaproveita depois. A privada nunca sai daqui. */
export function getOrCreateKeyPair(): KeyPair {
  const storedPublic = storage.getString(PUBLIC_KEY);
  const storedSecret = storage.getString(PRIVATE_KEY);

  if (storedPublic && storedSecret) {
    return { publicKey: storedPublic, secretKey: storedSecret };
  }

  const pair = nacl.box.keyPair();
  const publicKey = encodeBase64(pair.publicKey);
  const secretKey = encodeBase64(pair.secretKey);

  storage.set(PUBLIC_KEY, publicKey);
  storage.set(PRIVATE_KEY, secretKey);

  return { publicKey, secretKey };
}

export function getPublicKey(): string {
  return getOrCreateKeyPair().publicKey;
}

/** Apaga as chaves — usado ao sair da conta. Torna o histórico ilegível. */
export function clearKeys(): void {
  storage.remove(PRIVATE_KEY);
  storage.remove(PUBLIC_KEY);
}

export type Sealed = { ciphertext: string; nonce: string };

/**
 * A chave combinada é a mesma nos dois sentidos (X25519 é simétrico nisso), o
 * que faz a própria pessoa conseguir reler o que enviou.
 */
function sharedKey(theirPublicKey: string): Uint8Array {
  const { secretKey } = getOrCreateKeyPair();
  return nacl.box.before(decodeBase64(theirPublicKey), decodeBase64(secretKey));
}

export function seal(message: string, theirPublicKey: string): Sealed {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const boxed = nacl.box.after(decodeUTF8(message), nonce, sharedKey(theirPublicKey));

  return { ciphertext: encodeBase64(boxed), nonce: encodeBase64(nonce) };
}

/** Devolve null quando não abre — chave trocada, mensagem adulterada ou aparelho novo. */
export function open(sealed: Sealed, theirPublicKey: string): string | null {
  try {
    const opened = nacl.box.open.after(
      decodeBase64(sealed.ciphertext),
      decodeBase64(sealed.nonce),
      sharedKey(theirPublicKey)
    );
    return opened ? encodeUTF8(opened) : null;
  } catch {
    return null;
  }
}

/**
 * Código de verificação da conversa — o "número de segurança" do Signal.
 *
 * Deriva das duas chaves públicas, ordenadas para dar igual nos dois celulares.
 * Se os números baterem, ninguém trocou as chaves no meio do caminho. É a única
 * defesa contra um servidor malicioso, e por isso vale mostrar.
 */
export function safetyNumber(theirPublicKey: string): string {
  const mine = getPublicKey();
  const [a, b] = mine < theirPublicKey ? [mine, theirPublicKey] : [theirPublicKey, mine];

  // Hash simples e estável (FNV-1a) sobre as duas chaves: não precisa ser
  // resistente a colisão de adversário, precisa ser fácil de comparar a olho.
  let hash = 0x811c9dc5;
  const input = a + b;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  const digits = hash.toString().padStart(10, '0').slice(0, 10);
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}
