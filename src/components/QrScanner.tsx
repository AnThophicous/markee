import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/ThemeProvider';

type QrScannerProps = {
  onRead: (data: string) => void;
  /** Altura da janela da câmera. */
  height?: number;
};

/**
 * Leitor de QR. A câmera só é ligada depois da permissão, e o resultado é
 * entregue uma vez só: `onBarcodeScanned` dispara a cada quadro enquanto o
 * código estiver em frente à lente, e sem a trava o app tentaria adicionar a
 * mesma pessoa dezenas de vezes por segundo.
 */
export function QrScanner({ onRead, height = 280 }: QrScannerProps) {
  const { tokens } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [paused, setPaused] = useState(false);
  const handled = useRef(false);

  if (!permission) {
    return <View style={{ height }} className="rounded-2xl bg-subtle-light dark:bg-subtle-dark" />;
  }

  if (!permission.granted) {
    return (
      <View
        style={{ height }}
        className="items-center justify-center gap-3 rounded-2xl bg-subtle-light px-6 dark:bg-subtle-dark"
      >
        <Feather name="camera-off" size={26} color={tokens.muted} />
        <AppText variant="caption" className="text-center">
          Precisamos da câmera para ler o QR code. Nada é gravado — a imagem só é usada para achar o código.
        </AppText>
        <Button label="Permitir câmera" onPress={requestPermission} />
      </View>
    );
  }

  const handle = (data: string) => {
    if (handled.current) return;
    handled.current = true;
    setPaused(true);
    onRead(data);
  };

  return (
    <View style={{ height }} className="overflow-hidden rounded-2xl bg-black">
      {!paused ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => handle(data)}
        />
      ) : (
        <View className="flex-1 items-center justify-center gap-3">
          <Feather name="check-circle" size={28} color="#fff" />
          <Pressable
            onPress={() => {
              handled.current = false;
              setPaused(false);
            }}
            className="rounded-full bg-white/20 px-4 py-2"
          >
            <AppText variant="small" style={{ color: '#fff' }}>
              Ler outro
            </AppText>
          </Pressable>
        </View>
      )}

      {/* Moldura de mira. */}
      {!paused ? (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <View className="h-40 w-40 rounded-2xl border-2 border-white/70" />
        </View>
      ) : null}
    </View>
  );
}
