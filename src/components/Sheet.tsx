import { useEffect, type ReactNode } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/utils/cn';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  edge?: 'bottom' | 'left';
  children: ReactNode;
  widthClassName?: string;
};

/**
 * Curva de tempo, não mola: mola subamortecida oscila (vai e volta) e a folha
 * parece gelatina. 200ms com desaceleração é rápido e para seco.
 */
const OPEN = { duration: 200, easing: Easing.out(Easing.cubic) };
const CLOSE = { duration: 160, easing: Easing.in(Easing.cubic) };

export function Sheet({ visible, onClose, edge = 'bottom', children, widthClassName }: SheetProps) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const offscreen = edge === 'bottom' ? height : -width;
  const translate = useSharedValue(offscreen);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translate.value = withTiming(0, OPEN);
      backdrop.value = withTiming(1, OPEN);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const close = () => {
    translate.value = withTiming(offscreen, CLOSE);
    backdrop.value = withTiming(0, CLOSE, () => {
      runOnJS(onClose)();
    });
  };

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translate.value = edge === 'bottom' ? Math.max(0, event.translationY) : Math.min(0, event.translationX);
    })
    .onEnd((event) => {
      const shouldDismiss =
        edge === 'bottom' ? event.translationY > 120 : event.translationX < -100;
      if (shouldDismiss) {
        close();
      } else {
        translate.value = withTiming(0, OPEN);
      }
    });

  const panelStyle = useAnimatedStyle(() => ({
    transform: edge === 'bottom' ? [{ translateY: translate.value }] : [{ translateX: translate.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      {/*
        O Modal do React Native renderiza numa árvore de views separada, fora do
        GestureHandlerRootView do app. Sem este segundo root, NENHUM gesto
        funciona aqui dentro — foi por isso que o seletor de cor não se mexia.
      */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Pressable className="absolute inset-0" onPress={close}>
          <Animated.View className="absolute inset-0 bg-black/40" style={backdropStyle} />
        </Pressable>
        <GestureDetector gesture={pan}>
          <Animated.View
            className={cn(
              'absolute bg-surface-light dark:bg-surface-dark',
              edge === 'bottom'
                ? 'bottom-0 left-0 right-0 rounded-t-3xl px-5 pt-3'
                : cn('bottom-0 left-0 top-0', widthClassName ?? 'w-[280px]')
            )}
            style={[
              panelStyle,
              edge === 'bottom' ? { paddingBottom: insets.bottom + 24 } : { paddingTop: insets.top + 20 },
            ]}
          >
            {edge === 'bottom' ? (
              <View className="mb-3 h-1 w-10 self-center rounded-full bg-hairline-light dark:bg-hairline-dark" />
            ) : null}
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}
