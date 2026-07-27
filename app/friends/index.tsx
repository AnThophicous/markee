import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Divider } from '@/components/Divider';
import { EmptyState } from '@/components/EmptyState';
import {
  useAcceptFriend,
  useFriends,
  useOpenDm,
  useRemoveFriend,
} from '@/features/friends/hooks/useFriends';
import type { Friend } from '@/features/friends/services/friends.service';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

export default function FriendsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(16);

  const { data: friends, isLoading } = useFriends();
  const acceptFriend = useAcceptFriend();
  const removeFriend = useRemoveFriend();
  const openDm = useOpenDm();
  const [error, setError] = useState<string | null>(null);

  const incoming = (friends ?? []).filter((friend) => friend.status === 'incoming');
  const outgoing = (friends ?? []).filter((friend) => friend.status === 'outgoing');
  const accepted = (friends ?? []).filter((friend) => friend.status === 'accepted');

  const chat = (friend: Friend) => {
    setError(null);
    openDm.mutate(friend.userId, {
      onSuccess: (threadId) =>
        router.push({ pathname: '/friends/chat/[threadId]', params: { threadId, name: friend.displayName } }),
      onError: (e) => setError(e.message),
    });
  };

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader title="Amigos" rightIcon="user-plus" onRightPress={() => router.push('/friends/add')} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : (friends ?? []).length === 0 ? (
        <EmptyState
          icon="users"
          title="Nenhum amigo ainda"
          subtitle="Leia o QR code de alguém — ou mostre o seu — para começar a conversar."
        >
          <Button label="Adicionar amigo" onPress={() => router.push('/friends/add')} className="mt-2" />
        </EmptyState>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
          {error ? (
            <AppText variant="caption" className="px-4 pb-2 text-danger">
              {error}
            </AppText>
          ) : null}

          {incoming.length > 0 ? (
            <Section title={`PEDIDOS · ${incoming.length}`}>
              {incoming.map((friend) => (
                <Row key={friend.userId} friend={friend}>
                  <Pressable
                    onPress={() => acceptFriend.mutate(friend.userId)}
                    className="rounded-full bg-accent px-3.5 py-1.5"
                  >
                    <AppText variant="small" style={{ color: '#fff' }}>
                      Aceitar
                    </AppText>
                  </Pressable>
                  <Pressable onPress={() => removeFriend.mutate(friend.userId)} hitSlop={8} className="pl-2">
                    <Feather name="x" size={16} color={tokens.muted} />
                  </Pressable>
                </Row>
              ))}
            </Section>
          ) : null}

          {accepted.length > 0 ? (
            <Section title={`AMIGOS · ${accepted.length}`}>
              {accepted.map((friend) => (
                <Row key={friend.userId} friend={friend}>
                  <Pressable onPress={() => chat(friend)} hitSlop={8} className="px-1.5">
                    <Feather name="message-circle" size={19} color={tokens.accent} />
                  </Pressable>
                </Row>
              ))}
            </Section>
          ) : null}

          {outgoing.length > 0 ? (
            <Section title={`ENVIADOS · ${outgoing.length}`}>
              {outgoing.map((friend) => (
                <Row key={friend.userId} friend={friend}>
                  <AppText variant="small">Aguardando</AppText>
                  <Pressable onPress={() => removeFriend.mutate(friend.userId)} hitSlop={8} className="pl-2">
                    <Feather name="x" size={16} color={tokens.muted} />
                  </Pressable>
                </Row>
              ))}
            </Section>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-4 px-4">
      <AppText variant="small" className="mb-2 px-1">
        {title}
      </AppText>
      <View className="overflow-hidden rounded-2xl bg-surface-light dark:bg-surface-dark">{children}</View>
    </View>
  );
}

function Row({ friend, children }: { friend: Friend; children: React.ReactNode }) {
  const router = useRouter();

  return (
    <View>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.push({ pathname: '/u/[id]', params: { id: friend.userId } })}>
          {friend.avatarUrl ? (
            <Image source={{ uri: friend.avatarUrl }} className="h-10 w-10 rounded-full" />
          ) : (
            <View
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: friend.theme.colors[0] }}
            >
              <AppText style={{ color: '#fff', fontWeight: '700' }}>
                {friend.displayName.charAt(0).toUpperCase()}
              </AppText>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.push({ pathname: '/u/[id]', params: { id: friend.userId } })}
          className="flex-1"
        >
          <AppText variant="body" numberOfLines={1}>
            {friend.displayName}
          </AppText>
          {friend.headline ? (
            <AppText variant="small" numberOfLines={1}>
              {friend.headline}
            </AppText>
          ) : null}
        </Pressable>

        <View className="flex-row items-center">{children}</View>
      </View>
      <Divider className="ml-4" />
    </View>
  );
}
