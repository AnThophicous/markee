export type ThemeMode = 'light' | 'dark';

/**
 * Paleta preto e branco. A única cor é o rosa da marca (#F62283), reservado
 * para chamar ação — botão de nova nota, estado ativo, links e favoritos.
 * Preenchimentos neutros usam `subtle`, nunca o acento.
 */
const palette = {
  accent: '#F62283',
  accentSoftLight: '#FFF0F6',
  accentSoftDark: '#2A0A18',

  canvasLight: '#FFFFFF',
  surfaceLight: '#FFFFFF',
  subtleLight: '#F4F4F5',
  inkLight: '#0A0A0A',
  mutedLight: '#8A8A8E',
  hairlineLight: '#E7E7E9',

  // Preto absoluto no tema escuro: economiza bateria em telas OLED.
  canvasDark: '#000000',
  surfaceDark: '#0E0E0F',
  subtleDark: '#1A1A1C',
  inkDark: '#FAFAFA',
  mutedDark: '#8E8E93',
  hairlineDark: '#212123',

  danger: '#E5484D',
};

export const themes: Record<ThemeMode, {
  accent: string;
  accentSoft: string;
  canvas: string;
  surface: string;
  subtle: string;
  ink: string;
  muted: string;
  hairline: string;
  danger: string;
}> = {
  light: {
    accent: palette.accent,
    accentSoft: palette.accentSoftLight,
    canvas: palette.canvasLight,
    surface: palette.surfaceLight,
    subtle: palette.subtleLight,
    ink: palette.inkLight,
    muted: palette.mutedLight,
    hairline: palette.hairlineLight,
    danger: palette.danger,
  },
  dark: {
    accent: palette.accent,
    accentSoft: palette.accentSoftDark,
    canvas: palette.canvasDark,
    surface: palette.surfaceDark,
    subtle: palette.subtleDark,
    ink: palette.inkDark,
    muted: palette.mutedDark,
    hairline: palette.hairlineDark,
    danger: palette.danger,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const typography = {
  title: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  heading: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 17, fontWeight: '400' as const, lineHeight: 24 },
  bodyEmphasis: { fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  small: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
};

export const shadow = {
  subtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
};
