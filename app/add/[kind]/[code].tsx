import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useSession } from '@/features/auth/hooks/useSession';
import { descreverErroDeAfiliado } from '@/features/billing/afiliado';
import { useRegistrarIndicacao } from '@/features/billing/hooks/useAfiliado';
import { guardarCodigoPendente } from '@/features/billing/services/afiliado.service';
import { useSendFriendRequest } from '@/features/friends/hooks/useFriends';
import { useJoinGroup } from '@/features/groups/hooks/useGroups';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Destino dos links `markee://add/u/<código>` e `markee://add/g/<código>`.
 *
 * É a tela que abre quando alguém lê o QR com a câmera do sistema, fora do app.
 * Ela resolve o código e navega para onde interessa; não é uma tela para se
 * ficar olhando.
 */
export default function AddByCodeScreen() {
  const { kind, code } = useLocalSearchParams<{ kind: string; code: string }>();
  const router = useRouter();
  const { tokens } = useTheme();
  const { isSignedIn, isLoading: sessionLoading } = useSession();

  const sendRequest = useSendFriendRequest();
  const joinGroup = useJoinGroup();
  const registrarIndicacao = useRegistrarIndicacao();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [padrinho, setPadrinho] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading || !code) return;
    if (!isSignedIn) {
      // O link de afiliado é o único dos três que costuma chegar a quem AINDA
      // NÃO TEM CONTA — é exatamente esse o ponto de indicar alguém. Guardar o
      // código antes de mandar para o cadastro é o que impede a indicação de se
      // perder justo no caso mais comum do programa.
      if (kind === 'a') guardarCodigoPendente(code);
      router.replace('/login');
      return;
    }

    if (kind === 'a') {
      registrarIndicacao.mutate(code, {
        onSuccess: (nome) => {
          setPadrinho(nome);
          setDone(true);
        },
        onError: (e) => setError(descreverErroDeAfiliado(e.message) ?? e.message),
      });
      return;
    }

    if (kind === 'g') {
      joinGroup.mutate(code, {
        onSuccess: (group) => router.replace({ pathname: '/groups/[id]', params: { id: group.id } }),
        onError: (e) => setError(e.message),
      });
    } else {
      sendRequest.mutate(code, {
        onSuccess: () => setDone(true),
        onError: (e) => setError(e.message),
      });
    }
    // Roda uma vez por código; repetir mandaria o pedido de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, isSignedIn, kind, code]);

  if (error) {
    return (
      <Screen>
        <ScreenHeader title="Convite" showMenu={false} onBackPress={() => router.replace('/')} />
        <View className="flex-1 items-center justify-center gap-4 px-10">
          <Feather name="alert-circle" size={30} color={tokens.muted} />
          <AppText variant="caption" className="text-center">
            {error}
          </AppText>
          <Button label="Voltar ao início" variant="secondary" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }

  if (done && padrinho) {
    return (
      <Screen>
        <ScreenHeader title="Convite" showMenu={false} onBackPress={() => router.replace('/')} />
        <View className="flex-1 items-center justify-center gap-4 px-10">
          <Feather name="check-circle" size={30} color={tokens.accent} />
          <AppText variant="heading" className="text-center">
            Bem-vindo ao Markee
          </AppText>
          <AppText variant="caption" className="text-center">
            Você entrou pela indicação de {padrinho}. Não muda nada para você —
            o app é o mesmo. Se um dia você assinar o Pro, essa pessoa recebe uma
            parte.
          </AppText>
          <Button label="Começar" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen>
        <ScreenHeader title="Convite" showMenu={false} onBackPress={() => router.replace('/')} />
        <View className="flex-1 items-center justify-center gap-4 px-10">
          <Feather name="check-circle" size={30} color={tokens.accent} />
          <AppText variant="heading" className="text-center">
            Pedido enviado
          </AppText>
          <AppText variant="caption" className="text-center">
            Assim que a pessoa aceitar, vocês já podem conversar.
          </AppText>
          <Button label="Ver meus amigos" onPress={() => router.replace('/friends')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen className="items-center justify-center">
      <ActivityIndicator color={tokens.accent} />
    </Screen>
  );
}
