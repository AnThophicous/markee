import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { IconButton } from '@/components/IconButton';
import { signInWithGoogle } from '@/features/auth/services/auth.service';
import { useTheme } from '@/theme/ThemeProvider';

export default function LoginScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Algo deu errado.';
      // Desistir no navegador é uma ação do usuário, não um erro para exibir.
      if (message !== 'Login cancelado.') setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <View className="px-2" style={{ paddingTop: insets.top + 8 }}>
        <IconButton name="x" onPress={() => router.back()} />
      </View>

      <View className="flex-1 justify-center px-8 pb-24">
        <Image
          source={require('../assets/icon.png')}
          className="h-20 w-20 rounded-[20px]"
          resizeMode="contain"
        />

        <AppText variant="title" className="mt-6">
          Entrar no Markee
        </AppText>
        <AppText variant="caption" className="mt-2.5">
          Sua conta serve para grupos de estudo, materiais compartilhados e sincronização. Suas notas continuam no
          aparelho, funcionando offline com ou sem login.
        </AppText>

        {error ? (
          <AppText variant="caption" className="mt-5 text-danger">
            {error}
          </AppText>
        ) : null}

        <View className="mt-10">
          {busy ? (
            <View className="items-center py-4">
              <ActivityIndicator color={tokens.accent} />
            </View>
          ) : (
            <Pressable
              onPress={handleGoogle}
              className="flex-row items-center justify-center gap-3 rounded-2xl border border-hairline-light py-4 active:opacity-70 dark:border-hairline-dark"
            >
              <AntDesign name="google" size={18} color={tokens.ink} />
              <AppText variant="bodyEmphasis" style={{ fontSize: 16 }}>
                Continuar com Google
              </AppText>
            </Pressable>
          )}
        </View>

        <Pressable onPress={() => router.back()} className="mt-6 items-center py-2 active:opacity-60">
          <AppText variant="caption">Continuar sem conta</AppText>
        </Pressable>
      </View>
    </View>
  );
}
