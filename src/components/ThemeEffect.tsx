import { useEffect } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { VisualEffect } from '@/theme/visual';

type ThemeEffectProps = {
  effect: VisualEffect;
  width: number;
  height: number;
};

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/**
 * Camada de luz por cima do fundo colorido. Tudo é gradiente e transformação —
 * nenhuma partícula, nenhum emoji.
 *
 * `pointerEvents="none"` é essencial: a camada cobre o banner inteiro e sem
 * isso ela engoliria o toque que abre o seletor de aparência.
 */
export function ThemeEffect({ effect, width, height }: ThemeEffectProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    if (effect === 'none' || effect === 'shine' || effect === 'glow') return;

    const duration = effect === 'sweep' ? 2600 : effect === 'pulse' ? 2400 : effect === 'spin' ? 14000 : 6000;
    // `sweep` não deve voltar de ré: a faixa some de um lado e reaparece do
    // outro. Os demais ficam melhores indo e voltando.
    const reverse = effect !== 'sweep' && effect !== 'spin';

    progress.value = withRepeat(
      withTiming(1, { duration, easing: reverse ? Easing.inOut(Easing.sin) : Easing.linear }),
      -1,
      reverse
    );
  }, [effect, progress]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-width * 0.6, width * 1.2]) }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.04, 0.3]),
  }));

  const shiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-width * 0.25, width * 0.25]) }],
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));

  if (effect === 'shine') {
    return (
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.34)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={FILL}
      />
    );
  }

  if (effect === 'sweep') {
    return (
      <View pointerEvents="none" style={[FILL, { overflow: 'hidden' }]}>
        <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: width * 0.45 }, sweepStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.35 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    );
  }

  if (effect === 'pulse') {
    return (
      <Animated.View pointerEvents="none" style={[FILL, pulseStyle]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    );
  }

  if (effect === 'shift') {
    // Mais largo que o banner de propósito: ao deslizar, a borda do gradiente
    // nunca entra na área visível.
    return (
      <View pointerEvents="none" style={[FILL, { overflow: 'hidden' }]}>
        <Animated.View
          style={[
            { position: 'absolute', top: 0, bottom: 0, left: -width * 0.3, width: width * 1.6 },
            shiftStyle,
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.22)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    );
  }

  if (effect === 'spin') {
    // Quadrado com a diagonal do banner: girando, ele cobre a área toda.
    const side = Math.sqrt(width * width + height * height);
    return (
      <View pointerEvents="none" style={[FILL, { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}>
        <Animated.View style={[{ width: side, height: side }, spinStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.28)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    );
  }

  return null;
}
