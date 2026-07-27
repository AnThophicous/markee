import '../global.css';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';

import { ImageViewer } from '@/components/ImageViewer';
import { queryClient } from '@/services/queryClient';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AppDrawer } from '@/features/navigation/components/AppDrawer';

export default function RootLayout() {
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
