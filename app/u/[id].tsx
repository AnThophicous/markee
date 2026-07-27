import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { useSession } from '@/features/auth/hooks/useSession';
import { useFriends, useOpenDm, useRemoveFriend, useSendFriendRequest } from '@/features/friends/hooks/useFriends';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

/** Perfil de outra pessoa — somente leitura, com as ações de amizade. */
export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(32);
  const { user } = useSession();

  const { data: profile, isLoading } = useProfile(id);
  const { data: friends } = useFriends();
  const sendRequest = useSendFriendRequest();
  const removeFriend = useRemoveFriend();
  const openDm = useOpenDm();
  const [error, setError] = useState<string | null>(null);

  const link = (friends ?? []).find((friend) => friend.userId === id);
  const isMe = user?.id === id;

  if (isLoading) {
    return (
      <Screen className="items-center justify-center">
        <ActivityIndicator color={tokens.accent} />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <ScreenHeader title="Perfil" showMenu={false} onBackPress={() => router.back()} />
        <EmptyState icon="user-x" title="Perfil não encontrado" />
      </Screen>
    );
  }

  const chat = () => {
    setError(null);
    openDm.mutate(profile.id, {
      onSuccess: (threadId) =>
        router.push({
          pathname: '/friends/chat/[threadId]',
          params: { threadId, name: profile.displayName },
        }),
      onError: (e) => setError(e.message),
    });
  };

  const add = () => {
    setError(null);
    sendRequest.mutate(profile.friendCode, { onError: (e) => setError(e.message) });
  };

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader title={profile.displayName} showMenu={false} onBackPress={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
        <ProfileHeader profile={profile} />

        <View className="gap-2 px-5">
          {!profile.bio && !profile.headline ? (
            <View className="flex-row items-center gap-2.5 rounded-2xl bg-surface-light p-4 dark:bg-surface-dark">
              <Feather name="feather" size={16} color={tokens.muted} />
              <AppText variant="caption" className="flex-1">
                Esta pessoa ainda não escreveu uma bio.
              </AppText>
            </View>
          ) : null}

          {error ? (
            <AppText variant="caption" className="text-danger">
              {error}
            </AppText>
          ) : null}

          {isMe ? (
            <Button label="Editar meu perfil" variant="secondary" onPress={() => router.push('/profile')} />
          ) : link?.status === 'accepted' ? (
            <>
              <Button label={openDm.isPending ? 'Abrindo…' : 'Conversar'} onPress={chat} disabled={openDm.isPending} />
              <Button
                label="Desfazer amizade"
                variant="danger"
                onPress={() => removeFriend.mutate(profile.id)}
              />
            </>
          ) : link?.status === 'incoming' ? (
            <Button label="Ver pedido em Amigos" onPress={() => router.push('/friends')} />
          ) : link?.status === 'outgoing' ? (
            <Button label="Pedido enviado — aguardando" variant="secondary" disabled onPress={() => {}} />
          ) : (
            <Button
              label={sendRequest.isPending ? 'Enviando…' : 'Adicionar como amigo'}
              onPress={add}
              disabled={sendRequest.isPending}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
