import { useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { curva, duracao } from '@/theme/motion';

/**
 * A altura do teclado, como valor compartilhado.
 *
 * ISTO SUBSTITUI O `useAnimatedKeyboard` DO REANIMATED, E O MOTIVO É GRAVE.
 *
 * O `useAnimatedKeyboard` não se limita a informar a altura: ele assume o
 * controle da janela do Android. Chama `setDecorFitsSystemWindows(false)`,
 * instala um ouvinte de insets no `decorView` e, a cada passada de insets,
 * PROCURA a view `action_bar_root` do AppCompat e troca os `layoutParams` dela.
 * Isso roda na thread principal, fora de qualquer try/catch, e a primeira
 * passada de insets acontece assim que a primeira tela monta — ou seja, na
 * ABERTURA do app.
 *
 * A barra de navegação usa este valor e é desenhada no layout raiz, em todas as
 * telas. Então esse caminho passou a rodar em toda abertura, e o que a pessoa
 * viu foi o aviso do Android de que o app apresenta falhas continuamente: uma
 * queda nativa em laço, antes de existir tela para mostrar erro nenhum.
 *
 * Some a isso que o próprio Reanimated 4.5 marca o `useAnimatedKeyboard` como
 * DESCONTINUADO e manda usar outra coisa, e que ele chama o nativo durante o
 * render — não num efeito —, o que já é uma chamada nativa antes da árvore de
 * componentes existir.
 *
 * Aqui a troca é por `Keyboard`, do próprio React Native: ele só ESCUTA o
 * evento e não encosta na decoração da janela. O preço é honesto e pequeno: o
 * valor chega quando o sistema avisa, e não quadro a quadro. Por isso a
 * mudança entra com `withTiming` na mesma curva de saída do sistema — o olho
 * não distingue, e nenhum app fecha.
 */
export function useAlturaDoTeclado(): SharedValue<number> {
  const altura = useSharedValue(0);

  useEffect(() => {
    // No Android só `Did*` é confiável: o `Will*` não é emitido pelo sistema, e
    // registrar nele deixaria a barra parada com o teclado aberto.
    const abriu = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const fechou = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const aoAbrir = Keyboard.addListener(abriu, (evento) => {
      altura.value = withTiming(evento.endCoordinates?.height ?? 0, {
        duration: duracao.curta,
        easing: curva.entrada,
      });
    });

    const aoFechar = Keyboard.addListener(fechou, () => {
      altura.value = withTiming(0, { duration: duracao.curta, easing: curva.saida });
    });

    return () => {
      aoAbrir.remove();
      aoFechar.remove();
    };
  }, [altura]);

  return altura;
}
