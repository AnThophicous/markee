import '../global.css';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname, type ErrorBoundaryProps } from 'expo-router';

import { FatalScreen } from '@/components/FatalScreen';
import { ImageViewer } from '@/components/ImageViewer';
import { anotarQueda, instalarRelatorDeQuedas, registrarRota } from '@/services/crash-reporter';
import { queryClient } from '@/services/queryClient';
import { AvisoBar } from '@/components/AvisoBar';
import { configError } from '@/services/supabase';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AppDrawer } from '@/features/navigation/components/AppDrawer';
import { instalarGuardaDeSessao } from '@/features/auth/services/session-guard';

// Fora do componente, de propósito: precisa estar valendo antes do primeiro
// render, senão um erro na montagem inicial passaria sem ser anotado.
instalarRelatorDeQuedas();

// Também fora do componente: precisa estar escutando antes da primeira tela
// buscar qualquer coisa, senão a troca de conta que acontece durante a abertura
// passa sem limpar o cache.
instalarGuardaDeSessao();

/**
 * O expo-router chama isto quando uma tela quebra ao desenhar. Sem ele, o
 * aparelho encerra o processo e a pessoa recebe apenas o aviso do Android de que
 * "o app apresenta falhas continuamente" — que não diz nada a ninguém.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // O handler global não enxerga erro capturado por fronteira do React: para
  // ele, nada quebrou. Sem anotar aqui, esta queda não apareceria no registro.
  useEffect(() => {
    anotarQueda(error, false);
  }, [error]);

  return (
    <FatalScreen
      title="Alguma coisa quebrou"
      message="O app encontrou um erro que não sabia tratar. Suas notas continuam salvas no aparelho."
      detail={error.message}
      onRetry={retry}
    />
  );
}

/**
 * Guarda a tela atual para o registro de quedas. Saber em que tela aconteceu é
 * o que transforma uma pilha de chamadas ilegível em um lugar para procurar.
 */
function RastreadorDeRota() {
  const rota = usePathname();

  useEffect(() => {
    registrarRota(rota);
  }, [rota]);

  return null;
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
            <RastreadorDeRota />
            <AppDrawer />
            <ImageViewer />
            {/* Por último: fica por cima de tudo, inclusive de painel aberto —
                é justamente com um painel aberto que a pessoa acabou de tocar
                em algo e está esperando resposta. */}
            <AvisoBar />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
