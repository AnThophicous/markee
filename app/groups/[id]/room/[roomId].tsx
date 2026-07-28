import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { useSession } from '@/features/auth/hooks/useSession';
import { useMessages, useSendMessage } from '@/features/chat/hooks/useChat';
import { useGroupIdentity } from '@/features/groups/hooks/useGroupIdentity';
import { useMyPermissions, useRooms } from '@/features/groups/hooks/useGroups';
import { Permission, hasPermission } from '@/features/groups/permissions';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

export default function RoomScreen() {
  const { id, roomId } = useLocalSearchParams<{ id: string; roomId: string }>();
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(8);
  const { user } = useSession();

  const { data: rooms } = useRooms(id);
  const { data: messages, isLoading } = useMessages(roomId);
  const { data: perms } = useMyPermissions(id);
  const identidade = useGroupIdentity(id);
  const sendMessage = useSendMessage(roomId ?? '');

  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const room = (rooms ?? []).find((item) => item.id === roomId);
  const canSend = hasPermission(perms?.permissions ?? 0, Permission.SEND_MESSAGES, perms?.isOwner ?? false);

  const handleSend = () => {
    const content = draft.trim();
    if (!content) return;
    setError(null);
    setDraft('');
    sendMessage.mutate(content, {
      onError: (e) => {
        setError(e.message);
        setDraft(content);
      },
    });
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-canvas-light dark:bg-canvas-dark"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title={room ? `#${room.name}` : 'Sala'} showMenu={false} onBackPress={() => router.back()} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : (messages ?? []).length === 0 ? (
        <EmptyState icon="message-circle" title="Nenhuma mensagem" subtitle="Seja o primeiro a escrever aqui." />
      ) : (
        <FlashList
          data={messages ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
          maintainVisibleContentPosition={{
            startRenderingFromBottom: true,
            autoscrollToBottomThreshold: 0.2,
          }}
          renderItem={({ item }) => {
            const isMine = item.authorId === user?.id;
            // O nome de reserva é o que veio no join da mensagem: quem saiu do
            // grupo não está mais na lista de membros, mas as mensagens ficam.
            const quem = identidade(item.authorId, item.authorName);
            return (
              <View className={`mb-3 flex-row gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                {item.authorAvatar ? (
                  <Image source={{ uri: item.authorAvatar }} className="h-8 w-8 rounded-full" />
                ) : (
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-subtle-light dark:bg-subtle-dark">
                    <AppText variant="small">{quem.nome.charAt(0).toUpperCase()}</AppText>
                  </View>
                )}
                <View className={`max-w-[76%] ${isMine ? 'items-end' : 'items-start'}`}>
                  {!isMine ? (
                    <AppText variant="small" className="mb-0.5 px-1" style={{ color: quem.cor }}>
                      {quem.nome}
                    </AppText>
                  ) : null}
                  <View
                    className={`rounded-2xl px-3.5 py-2.5 ${
                      isMine ? 'bg-accent' : 'bg-subtle-light dark:bg-subtle-dark'
                    }`}
                  >
                    <AppText variant="body" className={isMine ? 'text-white' : undefined}>
                      {item.content}
                    </AppText>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {error ? (
        <AppText variant="caption" className="px-4 pb-1 text-danger">
          {error}
        </AppText>
      ) : null}

      {canSend ? (
        <View
          style={{ paddingBottom: bottom }}
          className="flex-row items-end gap-2 border-t border-hairline-light px-3 pt-2.5 dark:border-hairline-dark"
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Mensagem"
            placeholderTextColor={tokens.muted}
            multiline
            className="max-h-28 flex-1 rounded-2xl bg-subtle-light px-4 py-2.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
          />
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim()}
            className={`h-11 w-11 items-center justify-center rounded-full ${
              draft.trim() ? 'bg-accent' : 'bg-subtle-light dark:bg-subtle-dark'
            }`}
          >
            <Feather name="arrow-up" size={20} color={draft.trim() ? '#fff' : tokens.muted} />
          </Pressable>
        </View>
      ) : (
        <View
          style={{ paddingBottom: bottom + 16 }}
          className="flex-row items-center justify-center gap-2 border-t border-hairline-light px-4 pt-4 dark:border-hairline-dark"
        >
          <Feather name="lock" size={14} color={tokens.muted} />
          <AppText variant="caption">Você não pode enviar mensagens nesta sala</AppText>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
