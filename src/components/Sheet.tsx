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

import { useAlturaDoTeclado } from '@/hooks/useAlturaDoTeclado';
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

  /**
   * O painel sobe junto com o teclado.
   *
   * Sem isto, oito painéis do app tinham campo de texto invisível: o painel
   * fica colado no rodapé (`bottom: 0`) e o teclado subia por cima dele. Dava
   * para digitar sem ver o que estava sendo digitado — apelido, recado, nome de
   * categoria, comentário.
   *
   * O `Modal` do React Native não encolhe com o teclado no Android quando é
   * `statusBarTranslucent`, que é o nosso caso. Então o ajuste do sistema
   * (`adjustResize`) não alcança aqui e o painel precisa se mover por conta.
   *
   * Isto usava o `useAnimatedKeyboard` do Reanimated, que acompanha a altura
   * quadro a quadro e faria o painel subir COLADO no teclado. Saiu porque esse
   * hook assume o controle da janela do Android e derrubava o app na abertura —
   * a história inteira está em `useAlturaDoTeclado`.
   *
   * O que ficou é o evento do sistema, com uma curva de tempo por cima. Perde-se
   * o acompanhamento quadro a quadro; ganha-se um app que abre.
   */
  const teclado = useAlturaDoTeclado();

  useEffect(() => {
    if (visible) {
      translate.value = withTiming(0, OPEN);
      backdrop.value = withTiming(1, OPEN);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Worklet porque o gesto de arrastar chama isto da thread de UI, e função
  // comum chamada de lá derruba o processo inteiro ("Tried to synchronously
  // call a Remote Function"). Continua servindo ao onPress e ao botão voltar do
  // Android: worklet chamado da thread de JavaScript roda como qualquer função.
  const close = () => {
    'worklet';
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
    transform:
      edge === 'bottom'
        ? // A subida do teclado SOMA com a entrada e com o arrasto: os três
          // mexem no mesmo eixo, e tratá-los em transformações separadas faria
          // um cancelar o outro.
          [{ translateY: translate.value - teclado.value }]
        : [{ translateX: translate.value }],
  }));

  /**
   * A folga de baixo sai quando o teclado entra.
   *
   * `insets.bottom` reserva espaço para a barra de gestos do sistema. Com o
   * teclado aberto essa barra não está lá — manter a folga empurraria o painel
   * mais alto do que o necessário e abriria uma faixa vazia sobre o teclado.
   */
  const folgaInferior = useAnimatedStyle(() => ({
    paddingBottom: teclado.value > 0 ? 16 : insets.bottom + 24,
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
              edge === 'bottom' ? folgaInferior : { paddingTop: insets.top + 20 },
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
