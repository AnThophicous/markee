import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Espaço que a barra de navegação do sistema ocupa embaixo.
 *
 * O Android desenha o app de ponta a ponta (edge-to-edge), então sem esta
 * folga os botões de voltar/início ficam por cima do conteúdo. Em celular com
 * navegação por gestos o valor é pequeno; com os três botões, ~48dp.
 */
export function useBottomInset(extra = 0): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + extra;
}
