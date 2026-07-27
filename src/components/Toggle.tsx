import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

type ToggleProps = {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

const WIDTH = 46;
const HEIGHT = 28;
const KNOB = 22;
const PAD = 3;
const TIMING = { duration: 150, easing: Easing.out(Easing.cubic) };

/**
 * Interruptor próprio, no lugar do `Switch` do sistema.
 *
 * O nativo tem altura, cor e cantos diferentes em cada versão do Android e
 * destoa do resto do app. Este acompanha a cor de destaque escolhida nas
 * Configurações e responde na hora — o valor mostrado é o que veio por prop,
 * então quem chama controla o estado e toques repetidos não se perdem.
 */
export function Toggle({ value, onChange, disabled }: ToggleProps) {
  const { tokens } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, TIMING);
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [tokens.hairline, tokens.accent]),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (WIDTH - KNOB - PAD * 2) }],
  }));

  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Animated.View
        style={[
          trackStyle,
          { width: WIDTH, height: HEIGHT, borderRadius: HEIGHT / 2, padding: PAD, justifyContent: 'center' },
        ]}
      >
        <Animated.View
          style={[
            knobStyle,
            {
              width: KNOB,
              height: KNOB,
              borderRadius: KNOB / 2,
              backgroundColor: '#FFFFFF',
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2,
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
