import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

/** Criticamente amortecida: responde na hora, sem balançar depois. */
const PRESS = { damping: 40, stiffness: 500, mass: 1 };

type FabProps = {
  onPress: () => void;
  /** Segurar abre os modelos; o toque simples continua sendo o caminho rápido. */
  onLongPress?: () => void;
};

export function Fab({ onPress, onLongPress }: FabProps) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[style, { position: 'absolute', right: 20, bottom: insets.bottom + 20 }]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={280}
        onPressIn={() => {
          scale.value = withSpring(0.92, PRESS);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, PRESS);
        }}
        className="h-16 w-16 items-center justify-center rounded-full bg-accent"
        style={{
          shadowColor: '#F62283',
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        <Feather name="plus" size={26} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}
