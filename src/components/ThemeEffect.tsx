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
 *
 * ESTA VERSÃO É UM REFORÇO DA ANTERIOR, e vale registrar o que estava errado,
 * porque não era questão de gosto:
 *
 *   1. `shine` e `glow` não animavam nada. Eram gradiente parado — duas das
 *      sete opções não se distinguiam de "nenhum" a não ser por um véu claro
 *      que quase ninguém percebia.
 *   2. O `sweep` corria sem parar, de ponta a ponta. Brilho que passa a cada
 *      2,6 segundos para sempre vira ruído de fundo e o olho desliga. O que dá
 *      sensação de material caro é a PAUSA: a faixa cruza rápido, some, e
 *      demora a voltar.
 *   3. As opacidades eram baixas demais para sobreviver a fundo claro. 34% de
 *      branco sobre amarelo é invisível.
 *
 * Agora todo ciclo tem duas partes: o movimento e o descanso. É a diferença
 * entre um efeito que se nota e um que cansa.
 */
export function ThemeEffect({ effect, width, height }: ThemeEffectProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    if (effect === 'none') return;

    // A varredura tem ciclo longo porque a maior parte dele é PAUSA: o brilho
    // cruza o banner no primeiro quarto e o resto do tempo não há nada.
    const duracao =
      effect === 'sweep'
        ? 4200
        : effect === 'shine'
          ? 3400
          : effect === 'pulse'
            ? 2200
            : effect === 'spin'
              ? 12000
              : 5200;

    // `sweep` e `spin` não voltam de ré: a faixa some de um lado e reaparece do
    // outro, e giro que desgira parece defeito. Os demais ficam melhores indo e
    // voltando.
    const vaiEVolta = effect !== 'sweep' && effect !== 'spin';

    progress.value = withRepeat(
      withTiming(1, {
        duration: duracao,
        easing: vaiEVolta ? Easing.inOut(Easing.sin) : Easing.linear,
      }),
      -1,
      vaiEVolta
    );
  }, [effect, progress]);

  /**
   * A varredura: cruza rápido e depois descansa.
   *
   * Todo o movimento acontece no primeiro quarto do ciclo. Depois disso a faixa
   * fica parada fora da tela, e a opacidade zerada garante que ela não apareça
   * na borda em aparelho que arredonda pixel de outro jeito.
   */
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 0.25, 1],
          [-width * 0.7, width * 1.2, width * 1.2]
        ),
      },
      { rotate: '18deg' },
    ],
    opacity: interpolate(progress.value, [0, 0.04, 0.21, 0.25, 1], [0, 1, 1, 0, 0]),
  }));

  /** O brilho fixo, agora respirando em vez de parado. */
  const shineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.3, 0.62]),
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.06, 0.42]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1.16, 1]) }],
  }));

  /** O halo, que antes era só um booleano lido por outro componente. */
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.22, 0.5]),
  }));

  const shiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-width * 0.3, width * 0.3]) }],
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));

  if (effect === 'shine') {
    return (
      <Animated.View pointerEvents="none" style={[FILL, shineStyle]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.08)', 'rgba(0,0,0,0.12)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    );
  }

  if (effect === 'glow') {
    // Luz saindo de baixo, como se o cartão estivesse apoiado sobre algo aceso.
    return (
      <Animated.View pointerEvents="none" style={[FILL, glowStyle]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.7)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    );
  }

  if (effect === 'sweep') {
    return (
      <View pointerEvents="none" style={[FILL, { overflow: 'hidden' }]}>
        <Animated.View
          style={[
            // Mais alta que o banner porque vai inclinada: sem a sobra, os
            // cantos da faixa entrariam na área visível durante a rotação.
            { position: 'absolute', top: -height * 0.5, height: height * 2, width: width * 0.3 },
            sweepStyle,
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(255,255,255,0)',
              'rgba(255,255,255,0.25)',
              'rgba(255,255,255,0.85)',
              'rgba(255,255,255,0.25)',
              'rgba(255,255,255,0)',
            ]}
            locations={[0, 0.35, 0.5, 0.65, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    );
  }

  if (effect === 'pulse') {
    return (
      <View pointerEvents="none" style={[FILL, { overflow: 'hidden' }]}>
        <Animated.View style={[FILL, pulseStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.25)', 'rgba(255,255,255,0)']}
            locations={[0, 0.45, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    );
  }

  if (effect === 'shift') {
    // Mais largo que o banner de propósito: ao deslizar, a borda do gradiente
    // nunca entra na área visível.
    return (
      <View pointerEvents="none" style={[FILL, { overflow: 'hidden' }]}>
        <Animated.View
          style={[
            { position: 'absolute', top: 0, bottom: 0, left: -width * 0.35, width: width * 1.7 },
            shiftStyle,
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.4)']}
            locations={[0, 0.5, 1]}
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
      <View
        pointerEvents="none"
        style={[FILL, { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}
      >
        <Animated.View style={[{ width: side, height: side }, spinStyle]}>
          <LinearGradient
            colors={[
              'rgba(255,255,255,0.55)',
              'rgba(255,255,255,0)',
              'rgba(0,0,0,0.1)',
              'rgba(0,0,0,0.45)',
            ]}
            locations={[0, 0.35, 0.6, 1]}
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
