/**
 * O tema do grupo é o mesmo do perfil — a definição mora em theme/visual.ts.
 * Este arquivo existe só para o resto do código de grupos continuar falando em
 * "GroupTheme", que é como o domínio chama a coisa.
 */
export {
  CARD_ORDER,
  CARD_STYLES,
  DEFAULT_THEME,
  EFFECTS,
  EFFECT_ORDER,
  MAX_GRADIENT_STOPS,
  describeProError,
  isAnimatedIcon,
  isPremiumTheme,
  parseTheme,
} from '@/theme/visual';

export type {
  CardStyle,
  VisualEffect as GroupEffect,
  VisualTheme as GroupTheme,
  VisualThemeKind as GroupThemeKind,
} from '@/theme/visual';
