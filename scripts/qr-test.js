/**
 * Verificação do codificador de QR (src/utils/qrcode.ts).
 *
 * Ida-e-volta sozinha não prova quase nada: se a gravação e a leitura tiverem o
 * mesmo erro, o teste passa e nenhum celular lê o código. Por isso são quatro
 * conferências, três delas contra a norma e não contra o próprio código:
 *
 *   1. Informação de formato x tabela publicada da ISO/IEC 18004 (nível M).
 *   2. Reed-Solomon pela síndrome: a palavra completa tem de zerar nas
 *      primeiras `ec` potências de α — propriedade matemática, independente da
 *      minha implementação.
 *   3. Total de palavras por versão x tabela da norma.
 *   4. Ida-e-volta: a matriz é lida de volta por um decodificador escrito
 *      separadamente e o texto tem de bater.
 *
 * Rodar: node scripts/qr-test.js
 */

const fs = require('fs');
const path = require('path');

/**
 * Carrega o codificador transpilando o TypeScript com o próprio compilador do
 * projeto — nada de remover tipos na base do regex, que quebra em `as number`,
 * genéricos e afins.
 *
 * As funções internas são exportadas ao final para o teste conseguir conferir
 * as peças isoladamente (formato, Reed-Solomon, tabela de versões).
 */
function loadEncoder() {
  const ts = require('typescript');
  const source = fs.readFileSync(path.join(__dirname, '../src/utils/qrcode.ts'), 'utf8');

  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });

  const sandbox = { module: { exports: {} }, exports: {} };
  const extras = '\nmodule.exports.formatBits = formatBits;' +
    '\nmodule.exports.reedSolomon = reedSolomon;' +
    '\nmodule.exports.VERSION_SPEC = VERSION_SPEC;' +
    '\nmodule.exports.EXP = EXP;' +
    '\nmodule.exports.LOG = LOG;';

  const fn = new Function('module', 'exports', 'require', outputText + extras);
  fn(sandbox.module, sandbox.module.exports, require);
  return sandbox.module.exports;
}

const qr = loadEncoder();

let pass = 0;
let fail = 0;
const ok = (name) => { pass += 1; console.log('  OK   ' + name); };
const bad = (name, detail) => { fail += 1; console.log('  FAIL ' + name + (detail ? ' -> ' + detail : '')); };

/* ---------------------------------------- 1. informação de formato (nível M) */

console.log('\n== 1. Informação de formato x tabela da norma (nível M) ==');

// Valores publicados na ISO/IEC 18004, tabela C.1, para o nível M.
const FORMAT_M = [
  '101010000010010', '101000100100101', '101111001111100', '101101101001011',
  '100010111111001', '100000011001110', '100111110010111', '100101010100000',
];

FORMAT_M.forEach((expected, mask) => {
  const actual = qr.formatBits(mask).toString(2).padStart(15, '0');
  actual === expected
    ? ok(`máscara ${mask} -> ${actual}`)
    : bad(`máscara ${mask}`, `esperado ${expected}, obtido ${actual}`);
});

/* ------------------------------------------------ 2. Reed-Solomon (síndrome) */

console.log('\n== 2. Reed-Solomon pela síndrome ==');

const EXP = qr.EXP;
const LOG = qr.LOG;
const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function syndromeIsZero(data, ec) {
  const full = [...data, ...ec];
  for (let i = 0; i < ec.length; i += 1) {
    let value = 0;
    for (const byte of full) value = gfMul(value, EXP[i]) ^ byte;
    if (value !== 0) return false;
  }
  return true;
}

for (const ecCount of [10, 16, 18, 22, 24, 26]) {
  const data = Array.from({ length: 30 }, () => Math.floor(Math.random() * 256));
  const ec = qr.reedSolomon(data, ecCount);
  ec.length === ecCount && syndromeIsZero(data, ec)
    ? ok(`${ecCount} palavras de correção: síndrome zerada`)
    : bad(`${ecCount} palavras de correção`, 'síndrome diferente de zero');
}

/* -------------------------------------------- 3. total de palavras por versão */

console.log('\n== 3. Total de palavras por versão x norma ==');

// Total de codewords (dados + correção) das versões 1..10 — tabela 9 da norma.
const TOTAL = { 1: 26, 2: 44, 3: 70, 4: 100, 5: 134, 6: 172, 7: 196, 8: 242, 9: 292, 10: 346 };

for (let version = 1; version <= 10; version += 1) {
  const [ec, g1, w1, g2, w2] = qr.VERSION_SPEC[version];
  const total = g1 * (w1 + ec) + g2 * (w2 + ec);
  total === TOTAL[version]
    ? ok(`versão ${version}: ${total} palavras`)
    : bad(`versão ${version}`, `esperado ${TOTAL[version]}, obtido ${total}`);
}

/* ---------------------------------------------------------- 4. ida e volta */

console.log('\n== 4. Ida e volta (decodificador independente) ==');

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

const ALIGNMENT = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

/** Reconstrói o mapa de módulos reservados a partir da geometria da versão. */
function functionMap(size, version) {
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));
  const mark = (r, c) => {
    if (r >= 0 && r < size && c >= 0 && c < size) reserved[r][c] = true;
  };

  for (const [row, col] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r += 1) for (let c = -1; c <= 7; c += 1) mark(row + r, col + c);
  }
  for (const row of ALIGNMENT[version]) {
    for (const col of ALIGNMENT[version]) {
      if (reserved[row][col]) continue;
      for (let r = -2; r <= 2; r += 1) for (let c = -2; c <= 2; c += 1) mark(row + r, col + c);
    }
  }
  for (let i = 0; i < size; i += 1) { mark(6, i); mark(i, 6); }
  for (let i = 0; i <= 8; i += 1) { mark(8, i); mark(i, 8); }
  for (let i = 0; i < 8; i += 1) { mark(8, size - 1 - i); mark(size - 1 - i, 8); }
  return reserved;
}

/** Lê a máscara de volta a partir da cópia 1 da informação de formato. */
function readMask(matrix, size) {
  let bits = 0;
  for (let i = 0; i < 15; i += 1) {
    let bit;
    if (i < 6) bit = matrix[i][8];
    else if (i < 8) bit = matrix[i + 1][8];
    else bit = matrix[size - 15 + i][8];
    if (bit) bits |= 1 << i;
  }
  // Os 15 bits são 5 de dados (bits 14..10) + 10 de BCH. Dentro dos 5, os dois
  // primeiros são o nível de correção e os três últimos, a máscara.
  const unmasked = bits ^ 0b101010000010010;
  return (unmasked >> 10) & 0b111;
}

function decode(matrix) {
  const size = matrix.length;
  const version = (size - 17) / 4;
  const reserved = functionMap(size, version);
  const mask = readMask(matrix, size);

  // Lê os bits na mesma varredura em zigue-zague e desfaz a máscara.
  const bits = [];
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right -= 1;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (reserved[row][col]) continue;
        let bit = matrix[row][col];
        if (MASKS[mask](row, col)) bit = !bit;
        bits.push(bit ? 1 : 0);
      }
    }
    upward = !upward;
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    bytes.push(byte);
  }

  // Desfaz a intercalação para recuperar as palavras de dados em ordem.
  const [ec, g1, w1, g2, w2] = qr.VERSION_SPEC[version];
  const blockSizes = [...Array(g1).fill(w1), ...Array(g2).fill(w2)];
  const blocks = blockSizes.map(() => []);
  let index = 0;
  for (let i = 0; i < Math.max(w1, w2); i += 1) {
    for (let b = 0; b < blocks.length; b += 1) {
      if (i < blockSizes[b]) blocks[b].push(bytes[index++]);
    }
  }
  const data = blocks.flat();

  // Cabeçalho: 4 bits de modo + contador.
  const stream = [];
  for (const byte of data) for (let i = 7; i >= 0; i -= 1) stream.push((byte >> i) & 1);
  const read = (offset, length) => {
    let value = 0;
    for (let i = 0; i < length; i += 1) value = (value << 1) | stream[offset + i];
    return value;
  };

  const mode = read(0, 4);
  if (mode !== 0b0100) throw new Error('modo inesperado: ' + mode.toString(2));
  const countBits = version < 10 ? 8 : 16;
  const count = read(4, countBits);

  const out = [];
  for (let i = 0; i < count; i += 1) out.push(read(4 + countBits + i * 8, 8));
  return Buffer.from(out).toString('utf8');
}

const SAMPLES = [
  'markee://u/47f7a518',
  'markee://g/153a924d',
  'a',
  'https://markee.app/u/deadbeef',
  'Grupo de Estudos — Cálculo II 2026 · código d1e3d333',
  'x'.repeat(120),
  'çãéíóúÇÃÉ 🎓📚',
];

for (const sample of SAMPLES) {
  try {
    const matrix = qr.encodeQr(sample);
    const decoded = decode(matrix);
    decoded === sample
      ? ok(`${matrix.length}x${matrix.length}: ${JSON.stringify(sample.slice(0, 34))}`)
      : bad(JSON.stringify(sample.slice(0, 34)), `voltou ${JSON.stringify(decoded.slice(0, 40))}`);
  } catch (e) {
    bad(JSON.stringify(sample.slice(0, 34)), e.message);
  }
}

// Aleatórios, para varrer tamanhos e cair em várias versões e máscaras.
let randomOk = 0;
for (let i = 0; i < 200; i += 1) {
  const length = 1 + Math.floor(Math.random() * 100);
  const text = Array.from({ length }, () => String.fromCharCode(33 + Math.floor(Math.random() * 90))).join('');
  try {
    if (decode(qr.encodeQr(text)) === text) randomOk += 1;
  } catch {
    /* conta como falha abaixo */
  }
}
randomOk === 200 ? ok('200 textos aleatórios') : bad('textos aleatórios', `${randomOk}/200`);

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
