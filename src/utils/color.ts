/** Conversões de cor para o seletor. Tudo em HSV, que é como se escolhe cor à mão. */

export type Hsv = { h: number; s: number; v: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const val = clamp(v, 0, 1);

  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;

  let rgb: [number, number, number];
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return (
    '#' +
    rgb
      .map((channel) =>
        Math.round((channel + m) * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
      .toUpperCase()
  );
}

export function hexToHsv(hex: string): Hsv {
  const parsed = normalizeHex(hex) ?? '#F62283';
  const r = parseInt(parsed.slice(1, 3), 16) / 255;
  const g = parseInt(parsed.slice(3, 5), 16) / 255;
  const b = parseInt(parsed.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;

  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

/** Aceita `#abc`, `abc`, `#AABBCC`; devolve `#AABBCC` ou null se não der. */
export function normalizeHex(input: string): string | null {
  const value = input.trim().replace(/^#/, '');

  if (/^[0-9a-fA-F]{3}$/.test(value)) {
    return (
      '#' +
      value
        .split('')
        .map((char) => char + char)
        .join('')
        .toUpperCase()
    );
  }
  if (/^[0-9a-fA-F]{6}$/.test(value)) return '#' + value.toUpperCase();
  return null;
}

/**
 * Luminância relativa (WCAG). Serve para decidir se o texto por cima da cor
 * escolhida sai branco ou preto — sem isso, escolher amarelo deixa o nome do
 * grupo ilegível.
 */
export function luminance(hex: string): number {
  const parsed = normalizeHex(hex) ?? '#000000';
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(parsed.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function readableTextOn(hex: string): '#FFFFFF' | '#0A0A0A' {
  return luminance(hex) > 0.45 ? '#0A0A0A' : '#FFFFFF';
}

/** Versão bem clara da cor, para preenchimentos suaves (o antigo accentSoft). */
export function softTint(hex: string, dark: boolean): string {
  const { h, s } = hexToHsv(hex);
  return dark ? hsvToHex({ h, s: Math.min(s, 0.8), v: 0.16 }) : hsvToHex({ h, s: Math.min(s, 0.12), v: 1 });
}
