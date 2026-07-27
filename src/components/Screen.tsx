import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useBottomInset } from '@/hooks/useBottomInset';
import { cn } from '@/utils/cn';

type ScreenProps = {
  children: ReactNode;
  className?: string;
  /** Desligue quando a própria tela já cuida da folga (lista com contentContainer). */
  padBottom?: boolean;
  style?: ViewStyle;
};

/** Fundo da tela + folga para a barra de navegação do sistema. */
export function Screen({ children, className, padBottom = true, style }: ScreenProps) {
  const bottom = useBottomInset();

  return (
    <View
      className={cn('flex-1 bg-canvas-light dark:bg-canvas-dark', className)}
      style={[padBottom ? { paddingBottom: bottom } : null, style]}
    >
      {children}
    </View>
  );
}
