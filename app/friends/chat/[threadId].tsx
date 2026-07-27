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
import { safetyNumber } from '@/features/crypto/e2e';
import { useDmMessages, useSendDm, useThreadPeer } from '@/features/friends/hooks/useFriends';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

export default function DirectChatScreen() {
  const { threadId, name } = useLocalSearchParams<{ threadId: string; name?: string }>();
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(8);
  const { user } = useSession();

  const { data: messages, isLoading } = useDmMessages(threadId);
  const { data: peer } = useThreadPeer(threadId);
  const sendMessage = useSendDm(threadId ?? '');

  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showSafety, setShowSafety] = useState(false);

  const secured = Boolean(peer?.publicKey);

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
      <ScreenHeader
        title={name ?? 'Conversa'}
        showMenu={false}
        onBackPress={() => router.back()}
        rightIcon={secured ? 'lock' : 'unlock'}
        onRightPress={() => setShowSafety((current) => !current)}
      />

      {/* Estado da criptografia, sempre visível na primeira vez. */}
      <Pressable
        onPress={() => setShowSafety((current) => !current)}
        className="mx-3 mb-1 flex-row items-center gap-2 rounded-xl bg-subtle-light px-3 py-2 dark:bg-subtle-dark"
      >
        <Feather name={secured ? 'lock' : 'clock'} size={13} color={secured ? tokens.accent : tokens.muted} />
        <AppText variant="small" className="flex-1">
          {secured
            ? 'Ponta a ponta — nem o Markee consegue ler'
            : 'Aguardando a chave da outra pessoa para cifrar'}
        </AppText>
        <Feather name={showSafety ? 'chevron-up' : 'chevron-down'} size={13} color={tokens.muted} />
      </Pressable>

      {showSafety && peer?.publicKey ? (
        <View className="mx-3 mb-2 rounded-xl border border-hairline-light p-3 dark:border-hairline-dark">
          <AppText variant="small" className="mb-1">
            CÓDIGO DE VERIFICAÇÃO
          </AppText>
          <AppText variant="heading" style={{ letterSpacing: 3 }}>
            {safetyNumber(peer.publicKey)}
          </AppText>
          <AppText variant="small" className="mt-2">
            Comparem este número pessoalmente. Se for igual nos dois celulares, ninguém trocou as chaves no
            caminho. Ele muda se alguém reinstalar o app.
          </AppText>
        </View>
      ) : null}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : (messages ?? []).length === 0 ? (
        <EmptyState icon="message-circle" title="Conversa nova" subtitle="Diga oi." />
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
            return (
              <View className={`mb-3 flex-row gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                {item.authorAvatar ? (
                  <Image source={{ uri: item.authorAvatar }} className="h-8 w-8 rounded-full" />
                ) : (
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-subtle-light dark:bg-subtle-dark">
                    <AppText variant="small">{item.authorName.charAt(0).toUpperCase()}</AppText>
                  </View>
                )}
                <View className={`max-w-[76%] ${isMine ? 'items-end' : 'items-start'}`}>
                  <View
                    className={`rounded-2xl px-3.5 py-2.5 ${
                      item.unreadable
                        ? 'border border-dashed border-hairline-light dark:border-hairline-dark'
                        : isMine
                          ? 'bg-accent'
                          : 'bg-subtle-light dark:bg-subtle-dark'
                    }`}
                  >
                    {item.unreadable ? (
                      <View className="flex-row items-center gap-2">
                        <Feather name="lock" size={13} color={tokens.muted} />
                        <AppText variant="caption">
                          Não foi possível abrir — enviada para outra chave
                        </AppText>
                      </View>
                    ) : (
                      <AppText variant="body" className={isMine ? 'text-white' : undefined}>
                        {item.content}
                      </AppText>
                    )}
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
    </KeyboardAvoidingView>
  );
}
