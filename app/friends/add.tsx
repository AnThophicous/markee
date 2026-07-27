import { useState } from 'react';
import { Pressable, ScrollView, Share, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { QrCode } from '@/components/QrCode';
import { QrScanner } from '@/components/QrScanner';
import { useSession } from '@/features/auth/hooks/useSession';
import { useRegenerateFriendCode, useSendFriendRequest } from '@/features/friends/hooks/useFriends';
import { useJoinGroup } from '@/features/groups/hooks/useGroups';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';
import { parseMarkeeCode, prettyCode, profileLink } from '@/utils/markee-link';

type Tab = 'meu' | 'ler';

export default function AddFriendScreen() {
  const router = useRouter();
  const { tokens, mode } = useTheme();
  const bottom = useBottomInset(32);
  const { user } = useSession();

  const { data: profile } = useProfile(user?.id);
  const sendRequest = useSendFriendRequest();
  const regenerate = useRegenerateFriendCode(user?.id);
  const joinGroup = useJoinGroup();

  const [tab, setTab] = useState<Tab>('meu');
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'erro'; text: string } | null>(null);

  const friendCode = profile?.friendCode ?? '';

  /**
   * Um código lido pode ser de pessoa ou de grupo. Tratar os dois aqui evita
   * a pergunta "que tipo de QR é esse?" — o app descobre pelo próprio link.
   */
  const handleCode = (raw: string) => {
    const parsed = parseMarkeeCode(raw);
    if (!parsed) {
      setStatus({ kind: 'erro', text: 'Código não reconhecido.' });
      return;
    }

    setStatus(null);

    if (parsed.kind === 'group') {
      joinGroup.mutate(parsed.code, {
        onSuccess: (group) => router.replace({ pathname: '/groups/[id]', params: { id: group.id } }),
        onError: (e) => setStatus({ kind: 'erro', text: e.message }),
      });
      return;
    }

    sendRequest.mutate(parsed.code, {
      onSuccess: () => setStatus({ kind: 'ok', text: 'Pedido enviado. Assim que aceitarem, vocês já podem conversar.' }),
      onError: (e) => setStatus({ kind: 'erro', text: e.message }),
    });
  };

  const share = () =>
    Share.share({
      message: `Me adiciona no Markee: ${profileLink(friendCode)}\n\nOu use o código ${prettyCode(friendCode)}`,
    });

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader title="Adicionar" showMenu={false} onBackPress={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: bottom }} keyboardShouldPersistTaps="handled">
        <View className="mb-4 flex-row gap-2 px-4">
          {(['meu', 'ler'] as Tab[]).map((key) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3 ${
                tab === key ? 'bg-accent' : 'bg-subtle-light dark:bg-subtle-dark'
              }`}
            >
              <Feather
                name={key === 'meu' ? 'user' : 'camera'}
                size={15}
                color={tab === key ? '#fff' : tokens.ink}
              />
              <AppText variant="small" className={tab === key ? 'text-white' : 'text-ink-light dark:text-ink-dark'}>
                {key === 'meu' ? 'Meu código' : 'Ler código'}
              </AppText>
            </Pressable>
          ))}
        </View>

        {tab === 'meu' ? (
          <View className="items-center px-6">
            {friendCode ? (
              <>
                <QrCode
                  value={profileLink(friendCode)}
                  size={230}
                  color={mode === 'dark' ? '#0A0A0A' : '#0A0A0A'}
                />
                <AppText variant="heading" className="mt-4" style={{ letterSpacing: 2 }}>
                  {prettyCode(friendCode)}
                </AppText>
                <AppText variant="caption" className="mt-1 text-center">
                  Mostre este código para alguém ler — ou mande o link.
                </AppText>

                <View className="mt-5 w-full gap-2">
                  <Button label="Compartilhar meu código" onPress={share} />
                  <Button
                    label={regenerate.isPending ? 'Gerando…' : 'Gerar um código novo'}
                    variant="ghost"
                    disabled={regenerate.isPending}
                    onPress={() => regenerate.mutate()}
                  />
                </View>
                <AppText variant="small" className="mt-2 text-center">
                  Gerar outro invalida o código antigo — útil se ele foi parar onde não devia.
                </AppText>
              </>
            ) : (
              <AppText variant="caption">Carregando seu código…</AppText>
            )}
          </View>
        ) : (
          <View className="px-4">
            <QrScanner onRead={handleCode} />

            <AppText variant="small" className="mb-2 mt-5 px-1">
              OU DIGITE O CÓDIGO
            </AppText>
            <View className="flex-row gap-2">
              <TextInput
                value={typed}
                onChangeText={setTyped}
                placeholder="47f7a518"
                placeholderTextColor={tokens.muted}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => handleCode(typed)}
                className="flex-1 rounded-xl bg-subtle-light px-4 py-3.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
              />
              <Pressable
                onPress={() => handleCode(typed)}
                className="h-[50px] w-[50px] items-center justify-center rounded-xl bg-accent"
              >
                <Feather name="arrow-right" size={19} color="#fff" />
              </Pressable>
            </View>
          </View>
        )}

        {status ? (
          <AppText
            variant="caption"
            className={`mt-4 px-6 text-center ${status.kind === 'ok' ? 'text-accent' : 'text-danger'}`}
          >
            {status.text}
          </AppText>
        ) : null}
      </ScrollView>
    </View>
  );
}
