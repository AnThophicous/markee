import { Image, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { GLOW_SHADOW, ThemeBanner } from '@/components/ThemeBanner';
import { isAnimatedIcon, type GroupTheme } from '../theme';

type GroupBannerProps = {
  name: string;
  theme: GroupTheme;
  iconUrl: string | null;
  bannerUrl?: string | null;
  height?: number;
  children?: React.ReactNode;
};

/** Cabeçalho colorido do grupo: fundo do tema + ícone + nome. */
export function GroupBanner({ name, theme, iconUrl, bannerUrl, height = 168, children }: GroupBannerProps) {
  const glow = theme.effect === 'glow';

  return (
    <ThemeBanner theme={theme} imageUrl={bannerUrl} height={height}>
      <View className="absolute inset-0 justify-end p-4">
        <View className="flex-row items-center gap-3">
          {iconUrl ? (
            <View style={glow ? GLOW_SHADOW : undefined}>
              {/* GIF anima sozinho no RN. */}
              <Image source={{ uri: iconUrl }} className="h-16 w-16 rounded-2xl" resizeMode="cover" />
            </View>
          ) : (
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-black/25">
              <AppText style={{ fontSize: 24, fontWeight: '700', color: '#fff' }}>
                {name.charAt(0).toUpperCase()}
              </AppText>
            </View>
          )}

          <View className="flex-1">
            <AppText
              numberOfLines={1}
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: '#fff',
                textShadowColor: 'rgba(0,0,0,0.35)',
                textShadowRadius: 6,
              }}
            >
              {name}
            </AppText>
            {isAnimatedIcon(iconUrl) ? (
              <AppText variant="small" style={{ color: 'rgba(255,255,255,0.85)' }}>
                Ícone animado
              </AppText>
            ) : null}
          </View>

          {children}
        </View>
      </View>
    </ThemeBanner>
  );
}
