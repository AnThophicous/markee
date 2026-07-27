/**
 * Verificação da criptografia ponta a ponta.
 *
 * Simula dois aparelhos com pares de chaves diferentes e confere o que
 * realmente importa: que os dois leem, que um terceiro NÃO lê, que mensagem
 * adulterada não abre, e que o mesmo texto nunca gera o mesmo cifrado.
 *
 * Rodar: node scripts/e2e-test.js
 */
const nacl = require('tweetnacl');
const { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } = require('tweetnacl-util');
const crypto = require('crypto');

nacl.setPRNG((x, n) => {
  const b = crypto.randomBytes(n);
  for (let i = 0; i < n; i++) x[i] = b[i];
});

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d ? ' -> ' + d : '')); };

// Espelha src/features/crypto/e2e.ts
const mkDevice = () => {
  const kp = nacl.box.keyPair();
  return { publicKey: encodeBase64(kp.publicKey), secretKey: encodeBase64(kp.secretKey) };
};
const shared = (me, theirPub) => nacl.box.before(decodeBase64(theirPub), decodeBase64(me.secretKey));
const seal = (msg, me, theirPub) => {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  return { ciphertext: encodeBase64(nacl.box.after(decodeUTF8(msg), nonce, shared(me, theirPub))), nonce: encodeBase64(nonce) };
};
const open = (s, me, theirPub) => {
  try {
    const o = nacl.box.open.after(decodeBase64(s.ciphertext), decodeBase64(s.nonce), shared(me, theirPub));
    return o ? encodeUTF8(o) : null;
  } catch { return null; }
};

const ana = mkDevice();
const bruno = mkDevice();
const xereta = mkDevice();

console.log('== leitura pelos dois lados ==');
const msg = 'prova de cálculo é quinta, 14h — sala 203 çãé 🎓';
const sealed = seal(msg, ana, bruno.publicKey);

open(sealed, bruno, ana.publicKey) === msg ? ok('Bruno lê o que Ana mandou') : bad('Bruno não leu');
open(sealed, ana, bruno.publicKey) === msg ? ok('Ana relê o que ela mesma mandou') : bad('Ana não releu');

console.log('\n== quem não é da conversa ==');
open(sealed, xereta, ana.publicKey) === null ? ok('estranho com a chave da Ana não abre') : bad('VAZOU');
open(sealed, xereta, bruno.publicKey) === null ? ok('estranho com a chave do Bruno não abre') : bad('VAZOU');

// O caso do servidor curioso: tem o cifrado inteiro e as duas chaves PÚBLICAS.
open(sealed, { publicKey: ana.publicKey, secretKey: encodeBase64(nacl.box.keyPair().secretKey) }, bruno.publicKey) === null
  ? ok('servidor com as duas chaves públicas não abre') : bad('VAZOU para o servidor');

console.log('\n== integridade ==');
const bytes = decodeBase64(sealed.ciphertext);
bytes[3] ^= 0x01;
open({ ciphertext: encodeBase64(bytes), nonce: sealed.nonce }, bruno, ana.publicKey) === null
  ? ok('1 bit alterado no cifrado invalida') : bad('adulteração passou');

const wrongNonce = encodeBase64(nacl.randomBytes(nacl.box.nonceLength));
open({ ciphertext: sealed.ciphertext, nonce: wrongNonce }, bruno, ana.publicKey) === null
  ? ok('nonce trocado invalida') : bad('nonce trocado passou');

console.log('\n== nonce nunca se repete ==');
const seen = new Set();
let sameCipher = 0;
for (let i = 0; i < 500; i++) {
  const s = seal('mesma mensagem', ana, bruno.publicKey);
  if (seen.has(s.nonce)) sameCipher++;
  seen.add(s.nonce);
}
seen.size === 500 ? ok('500 envios, 500 nonces distintos') : bad('nonce repetido', String(500 - seen.size));

const a = seal('igual', ana, bruno.publicKey).ciphertext;
const b = seal('igual', ana, bruno.publicKey).ciphertext;
a !== b ? ok('mesmo texto gera cifrados diferentes') : bad('cifrado determinístico');

console.log('\n== código de verificação ==');
const safety = (mine, theirs) => {
  const [x, y] = mine < theirs ? [mine, theirs] : [theirs, mine];
  let h = 0x811c9dc5;
  const input = x + y;
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  const d = h.toString().padStart(10, '0').slice(0, 10);
  return `${d.slice(0,5)} ${d.slice(5)}`;
};
safety(ana.publicKey, bruno.publicKey) === safety(bruno.publicKey, ana.publicKey)
  ? ok('mesmo número nos dois celulares') : bad('números diferentes');
safety(ana.publicKey, bruno.publicKey) !== safety(ana.publicKey, xereta.publicKey)
  ? ok('chave trocada muda o número') : bad('número não mudou com outra chave');

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
