import '../global.css';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, type ErrorBoundaryProps } from 'expo-router';

import { FatalScreen } from '@/components/FatalScreen';
import { ImageViewer } from '@/components/ImageViewer';
import { queryClient } from '@/services/queryClient';
import { configError } from '@/services/supabase';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AppDrawer } from '@/features/navigation/components/AppDrawer';

/**
 * O expo-router chama isto quando uma tela quebra ao desenhar. Sem ele, o
 * aparelho encerra o processo e a pessoa recebe apenas o aviso do Android de que
 * "o app apresenta falhas continuamente" — que não diz nada a ninguém.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <FatalScreen
      title="Alguma coisa quebrou"
      message="O app encontrou um erro que não sabia tratar. Suas notas continuam salvas no aparelho."
      detail={error.message}
      onRetry={retry}
    />
  );
}

export default function RootLayout() {
  // Falta de configuração é detectada antes de montar os provedores: sem
  // servidor, todas as telas que dependem de rede falhariam uma a uma, e o
  // motivo verdadeiro se perderia no meio.
  if (configError) {
    return (
      <FatalScreen
        title="Este APK saiu incompleto"
        message={configError}
        detail="Compile de novo com EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY definidas — o scripts/env-check.js confere isso antes do build."
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
            <AppDrawer />
            <ImageViewer />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
