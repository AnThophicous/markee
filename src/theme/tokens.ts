export type ThemeMode = 'light' | 'dark';

/**
 * Paleta do Material 3, na leitura que o próprio Google usa nos apps dele.
 *
 * O que muda em relação ao preto e branco de antes: a hierarquia deixa de ser
 * feita por BORDA e passa a ser feita por TOM. No Material 3 uma superfície mais
 * alta é mais clara (no tema escuro) ou mais fria (no claro), e não uma caixa
 * com contorno. É por isso que existem quatro níveis de superfície aqui — sem
 * eles, o jeito Google de empilhar cartão não tem como ser desenhado.
 *
 * As quatro cores da marca do Google entram como ACENTO, nunca como fundo
 * grande. Azul para ação, e as outras três para categoria, gráfico e estado.
 * Um app que pinta blocos inteiros de vermelho Google não parece do Google —
 * parece um alerta.
 *
 * Todo par de texto sobre fundo daqui passa em 4.5:1 da WCAG. Não é opinião:
 * o scripts/theme-test.js confere par a par e derruba o build se algum cair.
 */

/** As quatro da marca. Valores oficiais. */
export const GOOGLE = {
  azul: '#4285F4',
  vermelho: '#EA4335',
  amarelo: '#FBBC04',
  verde: '#34A853',
} as const;

const claro = {
  /* ---- ação ---- */
  // Azul mais escuro que o #4285F4 da marca de propósito: o da marca dá 3,1:1
  // sobre branco e reprova para texto. Este é o que o Google usa como primária
  // no Material 3 justamente por isso.
  primary: '#0B57D0',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D3E3FD',
  onPrimaryContainer: '#041E49',

  /* ---- superfícies, do fundo para o topo ---- */
  surface: '#FFFFFF',
  surfaceLow: '#F8FAFD',
  surfaceMid: '#F0F4F9',
  surfaceHigh: '#E9EEF6',

  /* ---- tinta ---- */
  onSurface: '#1F1F1F',
  onSurfaceVariant: '#444746',

  /* ---- traços ---- */
  outline: '#747775',
  outlineVariant: '#C4C7C5',

  /* ---- erro ---- */
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#410E0B',
};

const escuro = {
  primary: '#A8C7FA',
  onPrimary: '#062E6F',
  primaryContainer: '#0842A0',
  onPrimaryContainer: '#D3E3FD',

  // Não é preto absoluto: no Material 3 a elevação é feita com tom, e partindo
  // do #000 não há para onde escurecer — todos os níveis colidiriam. O ganho de
  // bateria em OLED que o preto absoluto dava não compensa perder a hierarquia
  // inteira de superfícies.
  surface: '#131314',
  surfaceLow: '#1B1B1B',
  surfaceMid: '#1E1F20',
  surfaceHigh: '#282A2C',

  onSurface: '#E3E3E3',
  onSurfaceVariant: '#C4C7C5',

  outline: '#8E918F',
  outlineVariant: '#444746',

  error: '#F2B8B5',
  onError: '#601410',
  errorContainer: '#8C1D18',
  onErrorContainer: '#F9DEDC',
};

export type Tokens = typeof claro & {
  /* Nomes antigos, mantidos para as telas que ainda não migraram. */
  accent: string;
  accentSoft: string;
  canvas: string;
  subtle: string;
  ink: string;
  muted: string;
  hairline: string;
  danger: string;
};

/**
 * Os nomes antigos continuam existindo, apontando para os novos.
 *
 * São dezenas de telas usando `tokens.accent` e `tokens.canvas`. Trocar tudo de
 * uma vez seria um commit gigante onde um erro de digitação passa despercebido;
 * assim a paleta nova vale em TODA a interface imediatamente, e cada tela migra
 * para os nomes do Material 3 quando for mexida por outro motivo.
 */
function comApelidos(base: typeof claro): Tokens {
  return {
    ...base,
    accent: base.primary,
    accentSoft: base.primaryContainer,
    canvas: base.surface,
    subtle: base.surfaceMid,
    ink: base.onSurface,
    muted: base.onSurfaceVariant,
    hairline: base.outlineVariant,
    danger: base.error,
  };
}

export const themes: Record<ThemeMode, Tokens> = {
  light: comApelidos(claro),
  dark: comApelidos(escuro),
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

/**
 * A escala de canto do Material 3.
 *
 * O arredondamento não é decoração: é o que diz o TAMANHO do que se está vendo.
 * Canto pequeno em elemento grande faz o elemento parecer uma caixa; canto
 * grande em elemento pequeno o transforma numa pílula. A escala existe para a
 * relação ser consistente — e é o que dá a cara geométrica do Google.
 */
export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  /** O canto característico do Material 3: painéis, cartões grandes, diálogos. */
  xl: 28,
  /** Pílula. Botões, chips, avatares. */
  full: 9999,
};

/**
 * Sombra por NÍVEL, não por cor.
 *
 * No tema escuro sombra preta não aparece — o fundo já é escuro. Por isso a
 * elevação ali é feita subindo de superfície (`surfaceMid` -> `surfaceHigh`), e
 * a sombra fica só no tema claro. Usar sombra nos dois deixaria os cartões do
 * tema escuro visualmente planos, todos no mesmo plano.
 */
export function elevacao(nivel: 0 | 1 | 2 | 3, modo: ThemeMode) {
  if (modo === 'dark' || nivel === 0) return {};
  const mapa = {
    1: { radius: 3, opacity: 0.12, y: 1, elevation: 1 },
    2: { radius: 8, opacity: 0.14, y: 2, elevation: 3 },
    3: { radius: 16, opacity: 0.16, y: 4, elevation: 6 },
  } as const;
  const s = mapa[nivel];
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: s.y },
    shadowOpacity: s.opacity,
    shadowRadius: s.radius,
    elevation: s.elevation,
  };
}
