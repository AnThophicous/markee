import { type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ESCALA_AO_TOCAR, curva, duracao, mola } from '@/theme/motion';

/**
 * Qualquer coisa tocável, que responde ao dedo.
 *
 * Substitui o `Pressable` cru em tudo que é botão, cartão ou linha de lista. O
 * `active:opacity-70` do NativeWind, que estava espalhado pelo app, apaga o
 * elemento em vez de responder a ele — e apagar é o que se faz com coisa
 * desabilitada, o oposto da mensagem.
 *
 * Aqui o elemento AFUNDA: encolhe um pouco enquanto o dedo está em cima e volta
 * quando solta. É o gesto do Material — o toque empurra a superfície para
 * dentro da tela.
 *
 * A volta usa mola, e não curva de tempo, porque o dedo solta quando quer: uma
 * curva de tempo ignoraria o momento da soltura e completaria o caminho como se
 * nada tivesse mudado.
 */

/**
 * O `style` do Pressable também aceita uma FUNÇÃO do estado de pressão — é o
 * jeito antigo de reagir ao toque. Aqui ele é omitido: quem reage é a animação,
 * e aceitar as duas formas deixaria dois mecanismos disputando o mesmo estilo.
 */
type ToqueProps = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  /** Quanto encolhe. O padrão serve para quase tudo; cartão grande pede menos. */
  escala?: number;
  /** Some junto com o encolher. Útil quando o elemento não tem fundo próprio. */
  comOpacidade?: boolean;
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Toque({
  children,
  escala = ESCALA_AO_TOCAR,
  comOpacidade = false,
  style,
  disabled,
  ...resto
}: ToqueProps) {
  const pressionado = useSharedValue(0);

  const animado = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(1 - pressionado.value * (1 - escala), mola.firme),
      },
    ],
    opacity: comOpacidade
      ? withTiming(1 - pressionado.value * 0.25, { duration: duracao.instante, easing: curva.padrao })
      : 1,
  }));

  return (
    <AnimatedPressable
      // Desabilitado não afunda: responder ao toque prometeria uma ação que não
      // vai acontecer, e a pessoa tentaria de novo achando que não pegou.
      onPressIn={() => {
        if (!disabled) pressionado.value = 1;
      }}
      onPressOut={() => {
        pressionado.value = 0;
      }}
      disabled={disabled}
      style={[style, animado]}
      {...resto}
    >
      {children}
    </AnimatedPressable>
  );
}
