/**
 * Cor de cargo que dá para ler.
 *
 * A cor do cargo é escolhida por quem administra o grupo, e a maior parte das
 * pessoas escolhe pensando no tema escuro — é onde elas usam o app. Aí alguém
 * abre no tema claro e o cargo "Amarelo" vira texto amarelo sobre fundo branco:
 * o nome some.
 *
 * O Discord não tem esse problema porque só existe em fundo escuro. Aqui existem
 * os dois, então a cor precisa ser ajustada na hora de desenhar.
 *
 * O ajuste mexe só no BRILHO e preserva o tom. Quem escolheu vermelho continua
 * vendo vermelho — mais escuro no fundo claro, mais claro no fundo escuro. Trocar
 * o tom faria a pessoa achar que o app ignorou a escolha dela.
 */

/** Alvo de contraste da WCAG para texto pequeno. Nome de cargo é texto pequeno. */
const CONTRASTE_MINIMO = 4.5;

/** De quanto em quanto o brilho anda na busca. 2% erra pouco e converge rápido. */
const PASSO = 0.02;

type RGB = { r: number; g: number; b: number };

/** Aceita #RGB, #RRGGBB e sem o #. Devolve nulo se não for cor. */
export function lerHex(hex: string | null | undefined): RGB | null {
  if (!hex) return null;
  const limpo = hex.trim().replace(/^#/, '');

  const cheio =
    limpo.length === 3
      ? limpo[0] + limpo[0] + limpo[1] + limpo[1] + limpo[2] + limpo[2]
      : limpo;

  if (!/^[0-9a-fA-F]{6}$/.test(cheio)) return null;

  return {
    r: parseInt(cheio.slice(0, 2), 16) / 255,
    g: parseInt(cheio.slice(2, 4), 16) / 255,
    b: parseInt(cheio.slice(4, 6), 16) / 255,
  };
}

function paraHex({ r, g, b }: RGB): string {
  const canal = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${canal(r)}${canal(g)}${canal(b)}`;
}

/**
 * Luminância relativa da sRGB, na fórmula da WCAG. O expoente 2.4 desfaz a
 * curva gama do monitor: sem isso, cinza 50% pareceria ter metade do brilho do
 * branco, e não tem — tem cerca de 21%.
 */
function luminancia({ r, g, b }: RGB): number {
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Razão de contraste da WCAG: de 1 (idênticas) a 21 (preto sobre branco). */
export function contraste(a: string, b: string): number {
  const ca = lerHex(a);
  const cb = lerHex(b);
  if (!ca || !cb) return 1;

  const la = luminancia(ca);
  const lb = luminancia(cb);
  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);
  return (claro + 0.05) / (escuro + 0.05);
}

/* ------------------------------------------------------------ HSL ida e volta */

type HSL = { h: number; s: number; l: number };

function paraHsl({ r, g, b }: RGB): HSL {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return { h: 0, s: 0, l };

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h, s, l };
}

function paraRgb({ h, s, l }: HSL): RGB {
  if (s === 0) return { r: l, g: l, b: l };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const canal = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };

  return { r: canal(h + 1 / 3), g: canal(h), b: canal(h - 1 / 3) };
}

/* ------------------------------------------------------------------ o ajuste */

/**
 * A cor do cargo, ajustada para ser legível sobre `fundo`.
 *
 * Sem cor (membro sem cargo, ou cargo com cor inválida) devolve `padrao`, que é
 * a cor normal de texto do tema — o nome aparece como qualquer outro.
 */
export function corDeCargo(
  corDoCargo: string | null | undefined,
  fundo: string,
  padrao: string
): string {
  const rgb = lerHex(corDoCargo);
  if (!rgb) return padrao;

  const hexOriginal = paraHex(rgb);
  if (contraste(hexOriginal, fundo) >= CONTRASTE_MINIMO) return hexOriginal;

  const fundoRgb = lerHex(fundo);
  if (!fundoRgb) return hexOriginal;

  // Anda para longe do fundo: escurece sobre fundo claro, clareia sobre escuro.
  const fundoClaro = luminancia(fundoRgb) > 0.5;
  const hsl = paraHsl(rgb);

  let melhor = hexOriginal;
  let melhorContraste = contraste(hexOriginal, fundo);

  for (let passo = 1; passo * PASSO <= 1; passo++) {
    const l = fundoClaro ? hsl.l - passo * PASSO : hsl.l + passo * PASSO;
    if (l < 0 || l > 1) break;

    const candidato = paraHex(paraRgb({ ...hsl, l }));
    const c = contraste(candidato, fundo);

    // Guarda o melhor mesmo sem bater a meta: um cargo branco sobre fundo
    // branco não chega a 4.5 sem virar preto, e devolver preto seria pior do
    // que devolver o cinza mais escuro que ainda lembra a escolha original.
    if (c > melhorContraste) {
      melhorContraste = c;
      melhor = candidato;
    }
    if (c >= CONTRASTE_MINIMO) return candidato;
  }

  return melhor;
}
