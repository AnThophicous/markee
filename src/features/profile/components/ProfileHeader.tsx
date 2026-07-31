import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Foto } from '@/components/Foto';
import { GLOW_SHADOW, ThemeBanner } from '@/components/ThemeBanner';
import { useTheme } from '@/theme/ThemeProvider';
import type { Profile } from '../services/profile.service';
import { StatusBadge } from './StatusBadge';

type ProfileHeaderProps = {
  profile: Profile;
  isPro?: boolean;
  /** Só aparece no próprio perfil. */
  onPressAvatar?: () => void;
  onPressBanner?: () => void;
  onPressStatus?: () => void;
};

const BANNER_HEIGHT = 132;
const AVATAR = 92;

export function ProfileHeader({
  profile,
  isPro,
  onPressAvatar,
  onPressBanner,
  onPressStatus,
}: ProfileHeaderProps) {
  const { tokens } = useTheme();
  const glow = profile.theme.effect === 'glow';
  const editable = Boolean(onPressAvatar);

  return (
    <View style={{ marginBottom: AVATAR / 2 + 8 }}>
      <Pressable onPress={onPressBanner} disabled={!onPressBanner}>
        <ThemeBanner theme={profile.theme} imageUrl={profile.bannerUrl} height={BANNER_HEIGHT}>
          {onPressBanner ? (
            <View className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-black/30">
              <Feather name="image" size={15} color="#fff" />
            </View>
          ) : null}
        </ThemeBanner>
      </Pressable>

      {/* O avatar cavalga a borda do banner — por isso o marginBottom acima. */}
      <View style={{ marginTop: -AVATAR / 2 }} className="px-5">
        <View className="flex-row items-end gap-3">
          <Pressable onPress={onPressAvatar} disabled={!editable} style={glow ? GLOW_SHADOW : undefined}>
            <View
              className="rounded-full border-4 border-canvas-light dark:border-canvas-dark"
              style={{ width: AVATAR, height: AVATAR }}
            >
              {profile.avatarUrl ? (
                <Foto uri={profile.avatarUrl} style={{ width: '100%', height: '100%' }} raio={AVATAR} />
              ) : (
                <View
                  className="h-full w-full items-center justify-center rounded-full"
                  style={{ backgroundColor: profile.theme.colors[0] }}
                >
                  <AppText style={{ fontSize: 32, fontWeight: '700', color: '#fff' }}>
                    {(profile.displayName || 'E').charAt(0).toUpperCase()}
                  </AppText>
                </View>
              )}
            </View>
            {editable ? (
              <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-canvas-light bg-ink-light dark:border-canvas-dark dark:bg-subtle-dark">
                <Feather name="camera" size={13} color={tokens.canvas} />
              </View>
            ) : null}
          </Pressable>

          {isPro ? (
            <View className="mb-3 flex-row items-center gap-1 rounded-full bg-accent px-2.5 py-1">
              <Feather name="zap" size={11} color="#fff" />
              <AppText style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>PRO</AppText>
            </View>
          ) : null}
        </View>

        <View className="mt-2.5 flex-row flex-wrap items-baseline gap-2">
          <AppText variant="title" numberOfLines={1}>
            {profile.displayName}
          </AppText>
          {profile.pronouns ? <AppText variant="caption">· {profile.pronouns}</AppText> : null}
        </View>

        {profile.headline ? (
          <AppText variant="caption" className="mt-0.5" style={{ color: profile.theme.colors[0] }}>
            {profile.headline}
          </AppText>
        ) : null}

        <StatusBadge profile={profile} onPress={onPressStatus} />


        {profile.bio ? (
          <AppText variant="body" className="mt-2">
            {profile.bio}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
