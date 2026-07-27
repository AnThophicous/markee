import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useViewerStore } from '@/features/navigation/store/useUiStore';

const SNAP = { duration: 180, easing: Easing.out(Easing.cubic) };
const MAX_SCALE = 5;
const MIN_SCALE = 1;

/**
 * Visualizador em tela cheia: pinça para ampliar, arrasta para mover, dois
 * toques alternam entre 1x e 2.5x. Fica fora do expo-router de propósito —
 * as URLs das fotos são longas demais para virar parâmetro de rota.
 */
export function ImageViewer() {
  const images = useViewerStore((state) => state.images);
  const initialIndex = useViewerStore((state) => state.index);
  const close = useViewerStore((state) => state.close);

  const [index, setIndex] = useState(initialIndex);
  const visible = images.length > 0;

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, images]);

  if (!visible) return null;

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View className="flex-1 bg-black">
        <ZoomableImage key={images[index]} uri={images[index]} onClose={close} />
        <ViewerChrome
          count={images.length}
          index={index}
          onClose={close}
          onPrev={() => setIndex((current) => Math.max(0, current - 1))}
          onNext={() => setIndex((current) => Math.min(images.length - 1, current + 1))}
        />
      </View>
    </Modal>
  );
}

function ViewerChrome({
  count,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  count: number;
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <>
      <View style={{ top: insets.top + 8 }} className="absolute left-0 right-0 flex-row items-center px-4">
        <Pressable
          onPress={onClose}
          hitSlop={12}
          className="h-10 w-10 items-center justify-center rounded-full bg-white/15"
        >
          <Feather name="x" size={20} color="#fff" />
        </Pressable>
        <View className="flex-1" />
        {count > 1 ? (
          <View className="rounded-full bg-white/15 px-3 py-1.5">
            <AppText variant="small" style={{ color: '#fff' }}>
              {index + 1} / {count}
            </AppText>
          </View>
        ) : null}
      </View>

      {count > 1 ? (
        <View
          style={{ bottom: insets.bottom + 20 }}
          className="absolute left-0 right-0 flex-row items-center justify-center gap-6"
        >
          <Pressable
            onPress={onPrev}
            disabled={index === 0}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/15"
            style={{ opacity: index === 0 ? 0.3 : 1 }}
          >
            <Feather name="chevron-left" size={22} color="#fff" />
          </Pressable>
          <Pressable
            onPress={onNext}
            disabled={index === count - 1}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/15"
            style={{ opacity: index === count - 1 ? 0.3 : 1 }}
          >
            <Feather name="chevron-right" size={22} color="#fff" />
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

function ZoomableImage({ uri, onClose }: { uri: string; onClose: () => void }) {
  const { width, height } = useWindowDimensions();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const clampTranslation = () => {
    'worklet';
    // Quanto a imagem ampliada ultrapassa a tela em cada eixo.
    const overflowX = (width * scale.value - width) / 2;
    const overflowY = (height * scale.value - height) / 2;
    translateX.value = Math.min(overflowX, Math.max(-overflowX, translateX.value));
    translateY.value = Math.min(overflowY, Math.max(-overflowY, translateY.value));
  };

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(MAX_SCALE, Math.max(0.6, savedScale.value * event.scale));
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withTiming(MIN_SCALE, SNAP);
        translateX.value = withTiming(0, SNAP);
        translateY.value = withTiming(0, SNAP);
      }
      savedScale.value = Math.max(MIN_SCALE, scale.value);
      clampTranslation();
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((event) => {
      // Sem zoom não há para onde arrastar; deixa a imagem parada.
      if (scale.value <= 1) return;
      translateX.value = savedX.value + event.translationX;
      translateY.value = savedY.value + event.translationY;
    })
    .onEnd(() => {
      clampTranslation();
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomedIn = scale.value > 1.05;
      const next = zoomedIn ? 1 : 2.5;
      scale.value = withTiming(next, SNAP);
      savedScale.value = next;
      translateX.value = withTiming(0, SNAP);
      translateY.value = withTiming(0, SNAP);
      savedX.value = 0;
      savedY.value = 0;
    });

  // Um toque só fecha, mas apenas depois que o duplo-toque falha — senão o
  // primeiro toque do zoom fecharia o visualizador. E com a foto ampliada o
  // toque não fecha nada: quem está lendo um detalhe não quer sair sem querer.
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (scale.value <= 1.05) runOnJS(onClose)();
    });

  const gesture = Gesture.Race(
    Gesture.Simultaneous(pinch, pan),
    Gesture.Exclusive(doubleTap, singleTap)
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ flex: 1 }, style]}>
        <Image source={{ uri }} style={{ width, height }} resizeMode="contain" />
      </Animated.View>
    </GestureDetector>
  );
}
