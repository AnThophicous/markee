/**
 * Tema visual reutilizável — usado pelo banner do grupo, pelo cabeçalho do
 * perfil, pelo cartão do grupo nas listas e pelo convite. As telas seguem
 * exatamente a mesma regra de plano, e os gatilhos no banco
 * (validate_group_customization e validate_profile_customization) validam
 * esta mesma forma.
 *
 * Sem paletas prontas: as cores são escolhidas à mão no seletor. Os efeitos
 * são todos de luz e gradiente — nada de partícula nem emoji.
 */

export type VisualThemeKind = 'solid' | 'gradient';

export type VisualEffect =
  | 'none'
  /** Reflexo diagonal parado. */
  | 'shine'
  /** Halo em volta do ícone. */
  | 'glow'
  /** Faixa de luz atravessando de tempos em tempos. */
  | 'sweep'
  /** O fundo respira, clareando e escurecendo. */
  | 'pulse'
  /** As cores deslizam de um lado para o outro. */
  | 'shift'
  /** O gradiente gira devagar. */
  | 'spin';

/** Como o grupo aparece para os outros, na lista e no convite. */
export type CardStyle = 'plain' | 'tinted' | 'cover';

export type VisualTheme = {
  kind: VisualThemeKind;
  colors: string[];
  effect: VisualEffect;
  card: CardStyle;
};

export const DEFAULT_THEME: VisualTheme = {
  kind: 'solid',
  colors: ['#0B57D0'],
  effect: 'none',
  card: 'plain',
};

export const MAX_GRADIENT_STOPS = 4;

export type EffectInfo = {
  label: string;
  hint: string;
  pro: boolean;
};

export const EFFECTS: Record<VisualEffect, EffectInfo> = {
  none: { label: 'Nenhum', hint: 'Fundo liso', pro: false },
  shine: { label: 'Reflexo', hint: 'Brilho diagonal parado', pro: true },
  glow: { label: 'Halo', hint: 'Luz em volta do ícone', pro: true },
  sweep: { label: 'Varredura', hint: 'Faixa de luz atravessando', pro: true },
  pulse: { label: 'Pulso', hint: 'O fundo respira', pro: true },
  shift: { label: 'Deriva', hint: 'As cores deslizam', pro: true },
  spin: { label: 'Giro', hint: 'O gradiente gira devagar', pro: true },
};

export const EFFECT_ORDER: VisualEffect[] = ['none', 'shine', 'glow', 'sweep', 'pulse', 'shift', 'spin'];

export const CARD_STYLES: Record<CardStyle, { label: string; hint: string; pro: boolean }> = {
  plain: { label: 'Simples', hint: 'Só o ícone e o nome', pro: false },
  tinted: { label: 'Tingido', hint: 'Fundo com a sua cor', pro: true },
  cover: { label: 'Capa', hint: 'Cartão inteiro colorido', pro: true },
};

export const CARD_ORDER: CardStyle[] = ['plain', 'tinted', 'cover'];

const VALID_EFFECTS = new Set<string>(EFFECT_ORDER);
const VALID_CARDS = new Set<string>(CARD_ORDER);

export function parseTheme(raw: unknown): VisualTheme {
  if (!raw || typeof raw !== 'object') return DEFAULT_THEME;
  const value = raw as Partial<VisualTheme>;

  const colors =
    Array.isArray(value.colors) && value.colors.length > 0
      ? value.colors.slice(0, MAX_GRADIENT_STOPS).filter((color) => typeof color === 'string')
      : DEFAULT_THEME.colors;

  return {
    kind: value.kind === 'gradient' ? 'gradient' : 'solid',
    colors: colors.length > 0 ? colors : DEFAULT_THEME.colors,
    // Temas gravados antes desta versão podem trazer efeitos que não existem
    // mais (as antigas decorações de emoji); caem em 'none' sem quebrar a tela.
    effect:
      typeof value.effect === 'string' && VALID_EFFECTS.has(value.effect)
        ? (value.effect as VisualEffect)
        : 'none',
    card:
      typeof value.card === 'string' && VALID_CARDS.has(value.card)
        ? (value.card as CardStyle)
        : 'plain',
  };
}

/** O que o Pro libera. Espelha os gatilhos de validação. */
export function isPremiumTheme(theme: VisualTheme): boolean {
  return theme.kind === 'gradient' || theme.effect !== 'none' || theme.card !== 'plain';
}

export function isAnimatedIcon(url: string | null): boolean {
  return Boolean(url && url.toLowerCase().endsWith('.gif'));
}

/** Traduz o erro cru do gatilho numa frase que faz sentido para o usuário. */
export function describeProError(message: string): string | null {
  const match = message.match(/PRO_REQUIRED:(\w+)/);
  if (!match) return null;
  switch (match[1]) {
    case 'gradient':
      return 'Gradientes são do plano Pro. Cores sólidas continuam gratuitas.';
    case 'effect':
      return 'Efeitos de luz são do plano Pro.';
    case 'card':
      return 'Personalizar o cartão é do plano Pro.';
    case 'animated_icon':
      return 'Imagens animadas (GIF) são do plano Pro.';
    case 'banner':
      return 'Banner é do plano Pro.';
    default:
      return 'Este recurso é do plano Pro.';
  }
}
