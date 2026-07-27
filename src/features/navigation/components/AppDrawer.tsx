import { Image, Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { Sheet } from '@/components/Sheet';
import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { useSession } from '@/features/auth/hooks/useSession';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { useTheme } from '@/theme/ThemeProvider';
import { useUiStore } from '../store/useUiStore';

type NavItem = {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  href: Href;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Todas as notas', icon: 'file-text', href: '/' },
  { label: 'Favoritos', icon: 'star', href: '/favorites' },
  { label: 'Pastas', icon: 'folder', href: '/folder' },
  { label: 'Tags', icon: 'hash', href: '/tag' },
  { label: 'Lixeira', icon: 'trash-2', href: '/trash' },
];

const SOCIAL_ITEMS: NavItem[] = [
  { label: 'Grupos de estudo', icon: 'users', href: '/groups' },
  { label: 'Amigos', icon: 'user-plus', href: '/friends' },
];

export function AppDrawer() {
  const isOpen = useUiStore((state) => state.isDrawerOpen);
  const closeDrawer = useUiStore((state) => state.closeDrawer);
  const router = useRouter();
  const { tokens } = useTheme();
  const { user, isSignedIn } = useSession();
  const { data: profile } = useProfile(user?.id);

  const go = (href: Href) => {
    closeDrawer();
    router.push(href);
  };

  const displayName = profile?.displayName ?? 'Estudante';
  const initial = displayName.trim().charAt(0).toUpperCase();

  return (
    <Sheet visible={isOpen} onClose={closeDrawer} edge="left" widthClassName="w-[268px]">
      <AppText variant="heading" className="mb-4 px-2 text-accent">
        Markee
      </AppText>

      <View className="gap-1">
        {NAV_ITEMS.map((item) => (
          <Pressable
            key={item.label}
            onPress={() => go(item.href)}
            className="flex-row items-center gap-3 rounded-xl px-2 py-3 active:bg-subtle-light dark:active:bg-subtle-dark"
          >
            <Feather name={item.icon} size={18} color={tokens.ink} />
            <AppText variant="body">{item.label}</AppText>
          </Pressable>
        ))}
      </View>

      <Divider className="my-3" />

      {SOCIAL_ITEMS.map((item) => (
        <Pressable
          key={item.label}
          onPress={() => go(item.href)}
          className="flex-row items-center gap-3 rounded-xl px-2 py-3 active:bg-subtle-light dark:active:bg-subtle-dark"
        >
          <Feather name={item.icon} size={18} color={tokens.ink} />
          <AppText variant="body">{item.label}</AppText>
        </Pressable>
      ))}

      <Pressable
        onPress={() => go('/settings')}
        className="flex-row items-center gap-3 rounded-xl px-2 py-3 active:bg-subtle-light dark:active:bg-subtle-dark"
      >
        <Feather name="settings" size={18} color={tokens.ink} />
        <AppText variant="body">Configurações</AppText>
      </Pressable>

      <View className="mt-auto">
        <Divider className="my-3" />
        <Pressable
          onPress={() => go(isSignedIn ? '/profile' : '/login')}
          className="flex-row items-center gap-3 rounded-xl px-2 py-3 active:bg-subtle-light dark:active:bg-subtle-dark"
        >
          {isSignedIn ? (
            profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} className="h-9 w-9 rounded-full" />
            ) : (
              <View className="h-9 w-9 items-center justify-center rounded-full bg-accent">
                <AppText className="text-white" style={{ fontWeight: '700' }}>
                  {initial}
                </AppText>
              </View>
            )
          ) : (
            <View className="h-9 w-9 items-center justify-center rounded-full bg-subtle-light dark:bg-subtle-dark">
              <Feather name="user" size={16} color={tokens.muted} />
            </View>
          )}

          <View className="flex-1">
            <AppText variant="body" numberOfLines={1}>
              {isSignedIn ? displayName : 'Entrar'}
            </AppText>
            <AppText variant="small" numberOfLines={1}>
              {isSignedIn ? 'Ver perfil' : 'Para grupos de estudo'}
            </AppText>
          </View>
        </Pressable>
      </View>
    </Sheet>
  );
}
