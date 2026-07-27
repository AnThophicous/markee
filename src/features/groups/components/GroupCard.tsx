import { Image, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { GLOW_SHADOW, ThemeBanner } from '@/components/ThemeBanner';
import { useTheme } from '@/theme/ThemeProvider';
import { readableTextOn } from '@/utils/color';
import type { Group } from '../services/groups.service';

type GroupCardProps = {
  group: Group;
  onPress: () => void;
};

/**
 * Como o grupo aparece na lista de quem participa. O dono escolhe entre três
 * estilos (`theme.card`); o padrão continua sendo o mais discreto, para uma
 * lista com muitos grupos não virar um mural.
 */
export function GroupCard({ group, onPress }: GroupCardProps) {
  const { tokens } = useTheme();
  const { theme } = group;
  const subtitle = group.description || (group.mascotName ? `Mascote: ${group.mascotName}` : 'Grupo de estudo');

  if (theme.card === 'cover') {
    const ink = readableTextOn(theme.colors[0]);
    return (
      <Pressable onPress={onPress} className="mx-4 mb-2 overflow-hidden rounded-2xl active:opacity-85">
        <ThemeBanner theme={theme} imageUrl={group.bannerUrl} height={96}>
          <View className="absolute inset-0 flex-row items-center gap-3 px-4">
            <GroupIcon group={group} glow={theme.effect === 'glow'} />
            <View className="flex-1">
              <AppText
                numberOfLines={1}
                style={{ fontSize: 18, fontWeight: '700', color: ink, textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 5 }}
              >
                {group.name}
              </AppText>
              <AppText numberOfLines={1} style={{ fontSize: 13, color: ink, opacity: 0.85 }}>
                {subtitle}
              </AppText>
            </View>
            <Feather name="chevron-right" size={18} color={ink} />
          </View>
        </ThemeBanner>
      </Pressable>
    );
  }

  if (theme.card === 'tinted') {
    return (
      <Pressable
        onPress={onPress}
        className="mx-4 mb-2 flex-row items-center gap-3 overflow-hidden rounded-2xl px-4 py-3.5 active:opacity-70"
        // 0x1F ≈ 12% de opacidade: tinge sem brigar com o texto do tema claro.
        style={{ backgroundColor: theme.colors[0] + '1F' }}
      >
        <View className="w-1 self-stretch rounded-full" style={{ backgroundColor: theme.colors[0] }} />
        <GroupIcon group={group} glow={theme.effect === 'glow'} />
        <View className="flex-1">
          <AppText variant="bodyEmphasis" numberOfLines={1}>
            {group.name}
          </AppText>
          <AppText variant="caption" numberOfLines={1}>
            {subtitle}
          </AppText>
        </View>
        <Feather name="chevron-right" size={18} color={theme.colors[0]} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-3.5 active:bg-subtle-light dark:active:bg-subtle-dark"
    >
      <GroupIcon group={group} glow={false} />
      <View className="flex-1">
        <AppText variant="bodyEmphasis" numberOfLines={1}>
          {group.name}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      <Feather name="chevron-right" size={18} color={tokens.muted} />
    </Pressable>
  );
}

function GroupIcon({ group, glow }: { group: Group; glow: boolean }) {
  if (group.iconUrl) {
    return (
      <View style={glow ? GLOW_SHADOW : undefined}>
        <Image source={{ uri: group.iconUrl }} className="h-11 w-11 rounded-xl" />
      </View>
    );
  }

  return (
    <View
      className="h-11 w-11 items-center justify-center rounded-xl"
      style={{ backgroundColor: group.theme.colors[0] }}
    >
      <AppText style={{ color: readableTextOn(group.theme.colors[0]), fontWeight: '700', fontSize: 17 }}>
        {group.name.charAt(0).toUpperCase()}
      </AppText>
    </View>
  );
}
