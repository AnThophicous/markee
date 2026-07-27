/**
 * Codificador de QR Code — modo byte, nível de correção M, versões 1 a 10.
 *
 * Escrito à mão em vez de biblioteca porque o app precisa gerar exatamente um
 * tipo de conteúdo (uma URL curta do próprio Markee) e trazer um pacote inteiro
 * para isso não se paga. O que ele faz segue a ISO/IEC 18004: dados em modo
 * byte, correção Reed-Solomon, intercalação de blocos, oito máscaras avaliadas
 * por penalidade e informação de formato com BCH(15,5).
 *
 * A implementação é verificada por um teste de ida e volta (scripts/qr-test.js):
 * a matriz gerada é lida de volta e comparada com o texto original.
 */

export type QrMatrix = boolean[][];

/* ----------------------------------------------------------- Galois Field */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    // Polinômio primitivo do QR: x^8 + x^4 + x^3 + x^2 + 1
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/** Polinômio gerador de grau `degree`, para Reed-Solomon. */
function generatorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function reedSolomon(data: number[], ecCount: number): number[] {
  const gen = generatorPoly(ecCount);
  const result = new Array(ecCount).fill(0);

  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let i = 0; i < ecCount; i += 1) {
      result[i] ^= gfMul(gen[i + 1], factor);
    }
  }
  return result;
}

/* ------------------------------------------------------- Tabelas por versão */

/**
 * Por versão (1..10), nível M: [códigos de correção por bloco, blocos do
 * grupo 1, palavras por bloco do grupo 1, blocos do grupo 2, palavras do
 * grupo 2]. Valores da tabela 9 da ISO/IEC 18004.
 */
const VERSION_SPEC: Record<number, [number, number, number, number, number]> = {
  1: [10, 1, 16, 0, 0],
  2: [16, 1, 28, 0, 0],
  3: [26, 1, 44, 0, 0],
  4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0],
  6: [16, 4, 27, 0, 0],
  7: [18, 4, 31, 0, 0],
  8: [22, 2, 38, 2, 39],
  9: [22, 3, 36, 2, 37],
  10: [26, 4, 43, 1, 44],
};

/** Coordenadas centrais dos padrões de alinhamento, por versão. */
const ALIGNMENT: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

function totalDataBytes(version: number): number {
  const [, g1Blocks, g1Words, g2Blocks, g2Words] = VERSION_SPEC[version];
  return g1Blocks * g1Words + g2Blocks * g2Words;
}

function sizeOf(version: number): number {
  return version * 4 + 17;
}

/* ------------------------------------------------------------- Codificação */

function toUtf8(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    let code = char.codePointAt(0) as number;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

class BitBuffer {
  private bits: number[] = [];

  put(value: number, length: number) {
    for (let i = length - 1; i >= 0; i -= 1) {
      this.bits.push((value >> i) & 1);
    }
  }

  get length(): number {
    return this.bits.length;
  }

  toBytes(): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j += 1) {
        byte = (byte << 1) | (this.bits[i + j] ?? 0);
      }
      bytes.push(byte);
    }
    return bytes;
  }
}

function pickVersion(byteLength: number): number {
  for (let version = 1; version <= 10; version += 1) {
    // 4 bits de modo + contador (8 bits até a versão 9, 16 daí em diante).
    const countBits = version < 10 ? 8 : 16;
    const capacity = totalDataBytes(version) * 8 - 4 - countBits;
    if (byteLength * 8 <= capacity) return version;
  }
  throw new Error('Conteúdo longo demais para o QR.');
}

function buildCodewords(text: string): { version: number; codewords: number[] } {
  const data = toUtf8(text);
  const version = pickVersion(data.length);
  const countBits = version < 10 ? 8 : 16;
  const capacityBytes = totalDataBytes(version);

  const buffer = new BitBuffer();
  buffer.put(0b0100, 4); // modo byte
  buffer.put(data.length, countBits);
  for (const byte of data) buffer.put(byte, 8);

  // Terminador de até 4 bits, depois completa o byte.
  const remaining = capacityBytes * 8 - buffer.length;
  buffer.put(0, Math.min(4, remaining));
  while (buffer.length % 8 !== 0) buffer.put(0, 1);

  // Enchimento alternando 0xEC / 0x11, começando sempre por 0xEC.
  const bytes = buffer.toBytes();
  const PAD = [0xec, 0x11];
  for (let i = 0; bytes.length < capacityBytes; i += 1) {
    bytes.push(PAD[i % 2]);
  }

  return { version, codewords: bytes.slice(0, capacityBytes) };
}

/** Divide em blocos, calcula a correção e intercala como a norma manda. */
function interleave(version: number, codewords: number[]): number[] {
  const [ecPerBlock, g1Blocks, g1Words, g2Blocks, g2Words] = VERSION_SPEC[version];

  const blocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;

  for (let i = 0; i < g1Blocks; i += 1) {
    const block = codewords.slice(offset, offset + g1Words);
    offset += g1Words;
    blocks.push(block);
    ecBlocks.push(reedSolomon(block, ecPerBlock));
  }
  for (let i = 0; i < g2Blocks; i += 1) {
    const block = codewords.slice(offset, offset + g2Words);
    offset += g2Words;
    blocks.push(block);
    ecBlocks.push(reedSolomon(block, ecPerBlock));
  }

  const result: number[] = [];
  const maxData = Math.max(g1Words, g2Words);
  for (let i = 0; i < maxData; i += 1) {
    for (const block of blocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i += 1) {
    for (const block of ecBlocks) result.push(block[i]);
  }
  return result;
}

/* ---------------------------------------------------------------- Matriz */

type Grid = { modules: (boolean | null)[][]; reserved: boolean[][]; size: number };

function createGrid(version: number): Grid {
  const size = sizeOf(version);
  return {
    size,
    modules: Array.from({ length: size }, () => new Array<boolean | null>(size).fill(null)),
    reserved: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
  };
}

function place(grid: Grid, row: number, col: number, value: boolean, reserve = true) {
  grid.modules[row][col] = value;
  if (reserve) grid.reserved[row][col] = true;
}

function drawFinder(grid: Grid, row: number, col: number) {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= grid.size || cc < 0 || cc >= grid.size) continue;
      const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      place(grid, rr, cc, inRing || inCore);
    }
  }
}

function drawAlignment(grid: Grid, version: number) {
  const centers = ALIGNMENT[version];
  for (const row of centers) {
    for (const col of centers) {
      // Pula onde os localizadores já estão.
      if (grid.reserved[row][col]) continue;
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          const isDark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
          place(grid, row + r, col + c, isDark);
        }
      }
    }
  }
}

function drawTiming(grid: Grid) {
  for (let i = 8; i < grid.size - 8; i += 1) {
    const dark = i % 2 === 0;
    if (!grid.reserved[6][i]) place(grid, 6, i, dark);
    if (!grid.reserved[i][6]) place(grid, i, 6, dark);
  }
}

/** Marca (sem pintar) os 31 módulos da informação de formato. */
function reserveFormat(grid: Grid) {
  for (let i = 0; i <= 8; i += 1) {
    if (i !== 6) {
      grid.reserved[8][i] = true;
      grid.reserved[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i += 1) {
    grid.reserved[8][grid.size - 1 - i] = true;
    grid.reserved[grid.size - 1 - i][8] = true;
  }
  // Módulo escuro fixo.
  place(grid, grid.size - 8, 8, true);
}

const MASKS: ((row: number, col: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function placeData(grid: Grid, data: number[], mask: number) {
  let bitIndex = 0;
  let upward = true;

  for (let right = grid.size - 1; right > 0; right -= 2) {
    // A coluna 6 é o padrão de tempo vertical; a varredura a ignora.
    if (right === 6) right -= 1;

    for (let step = 0; step < grid.size; step += 1) {
      const row = upward ? grid.size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (grid.reserved[row][col]) continue;

        const byte = data[bitIndex >> 3] ?? 0;
        let bit = ((byte >> (7 - (bitIndex & 7))) & 1) === 1;
        bitIndex += 1;

        if (MASKS[mask](row, col)) bit = !bit;
        grid.modules[row][col] = bit;
      }
    }
    upward = !upward;
  }
}

/** BCH(15,5) da informação de formato, nível M (00) + máscara. */
function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask;
  let value = data << 10;
  for (let i = 4; i >= 0; i -= 1) {
    if ((value >> (i + 10)) & 1) value ^= 0b10100110111 << i;
  }
  return ((data << 10) | value) ^ 0b101010000010010;
}

/**
 * Cada bit de formato é gravado duas vezes, e a ordem NÃO é a mesma nos dois
 * braços: na coluna 8 os bits sobem do 0 ao 14, e na linha 8 eles correm da
 * direita para a esquerda. Trocar isso gera um QR que parece certo a olho nu e
 * que nenhum leitor consegue abrir — é a informação que diz qual máscara usar.
 */
function drawFormat(grid: Grid, mask: number) {
  const bits = formatBits(mask);
  const size = grid.size;

  for (let i = 0; i < 15; i += 1) {
    const bit = ((bits >> i) & 1) === 1;

    // Coluna 8: linhas 0-5, depois 7 e 8, e o resto no canto inferior.
    if (i < 6) grid.modules[i][8] = bit;
    else if (i < 8) grid.modules[i + 1][8] = bit;
    else grid.modules[size - 15 + i][8] = bit;

    // Linha 8: colunas da direita, depois a 7 e as da esquerda.
    if (i < 8) grid.modules[8][size - 1 - i] = bit;
    else if (i === 8) grid.modules[8][7] = bit;
    else grid.modules[8][14 - i] = bit;
  }

  grid.modules[size - 8][8] = true; // módulo escuro fixo
}

/** Penalidade da norma — quanto menor, melhor o QR é lido. */
function penalty(grid: Grid): number {
  const size = grid.size;
  const at = (r: number, c: number) => grid.modules[r][c] === true;
  let score = 0;

  // Regra 1: sequências de 5+ iguais.
  for (let i = 0; i < size; i += 1) {
    for (const horizontal of [true, false]) {
      let run = 1;
      for (let j = 1; j < size; j += 1) {
        const prev = horizontal ? at(i, j - 1) : at(j - 1, i);
        const cur = horizontal ? at(i, j) : at(j, i);
        if (cur === prev) {
          run += 1;
        } else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  }

  // Regra 2: blocos 2x2 da mesma cor.
  for (let r = 0; r < size - 1; r += 1) {
    for (let c = 0; c < size - 1; c += 1) {
      const v = at(r, c);
      if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) score += 3;
    }
  }

  // Regra 3: padrão parecido com localizador (1011101 com folga clara).
  const pattern = [true, false, true, true, true, false, true, false, false, false, false];
  const reversed = [...pattern].reverse();
  const matches = (get: (k: number) => boolean, start: number, list: boolean[]) =>
    list.every((expected, k) => get(start + k) === expected);

  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j <= size - 11; j += 1) {
      if (matches((k) => at(i, k), j, pattern) || matches((k) => at(i, k), j, reversed)) score += 40;
      if (matches((k) => at(k, i), j, pattern) || matches((k) => at(k, i), j, reversed)) score += 40;
    }
  }

  // Regra 4: desequilíbrio entre claros e escuros.
  let dark = 0;
  for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) if (at(r, c)) dark += 1;
  const ratio = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;

  return score;
}

/** Gera a matriz do QR. `true` = módulo escuro. */
export function encodeQr(text: string): QrMatrix {
  const { version, codewords } = buildCodewords(text);
  const data = interleave(version, codewords);

  let best: Grid | null = null;
  let bestScore = Infinity;

  for (let mask = 0; mask < 8; mask += 1) {
    const grid = createGrid(version);
    drawFinder(grid, 0, 0);
    drawFinder(grid, 0, grid.size - 7);
    drawFinder(grid, grid.size - 7, 0);
    drawAlignment(grid, version);
    drawTiming(grid);
    reserveFormat(grid);
    placeData(grid, data, mask);
    drawFormat(grid, mask);

    const score = penalty(grid);
    if (score < bestScore) {
      bestScore = score;
      best = grid;
    }
  }

  const grid = best as Grid;
  return grid.modules.map((row) => row.map((cell) => cell === true));
}
