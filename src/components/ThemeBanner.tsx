import type { ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Foto } from '@/components/Foto';
import { ThemeEffect } from '@/components/ThemeEffect';
import type { VisualTheme } from '@/theme/visual';

type ThemeBannerProps = {
  theme: VisualTheme;
  imageUrl?: string | null;
  height?: number;
  /** Quando o bloco não ocupa a largura da tela (cartões, prévias). */
  width?: number;
  children?: ReactNode;
};

/** Sombra de halo usada pelo efeito `glow`. Vai numa View: `elevation` não existe em ImageStyle. */
export const GLOW_SHADOW = {
  shadowColor: '#fff',
  shadowOpacity: 0.9,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 0 },
  elevation: 12,
} as const;

/**
 * Fundo colorido de grupo e de perfil. Cor sólida é o padrão; gradiente e
 * efeito só chegam aqui se o banco tiver aceitado o tema — ou seja, se a conta
 * for Pro.
 */
export function ThemeBanner({ theme, imageUrl, height = 168, width, children }: ThemeBannerProps) {
  const window = useWindowDimensions();
  const effectiveWidth = width ?? window.width;
  const colors = theme.colors.length >= 2 ? theme.colors : [theme.colors[0], theme.colors[0]];

  return (
    <View style={{ height }} className="overflow-hidden">
      {theme.kind === 'gradient' ? (
        <LinearGradient
          colors={colors as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: theme.colors[0] }} />
      )}

      {imageUrl ? (
        <Foto uri={imageUrl} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      ) : null}

      <ThemeEffect effect={theme.effect} width={effectiveWidth} height={height} />

      {children}
    </View>
  );
}
