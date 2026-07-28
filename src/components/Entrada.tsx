import { type ReactNode } from 'react';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';

import { atrasoEmCascata, curva, duracao } from '@/theme/motion';

/**
 * Como uma coisa aparece na tela.
 *
 * Existe para a entrada ser sempre a mesma em toda a interface. Espalhado, cada
 * tela escolhe uma duração e um sentido diferentes — e o app inteiro passa a
 * parecer feito por cinco pessoas que não se falaram.
 *
 * O SENTIDO carrega significado, não é escolha estética:
 *   'sobe'   coisa que chega de baixo — item de lista, conteúdo novo
 *   'desce'  coisa que vem do topo — aviso, cabeçalho
 *   'cresce' coisa que nasce onde está — cartão, gráfico, número
 *   'surge'  só aparece, sem deslocar — texto trocando dentro de um bloco
 *
 * `indice` liga a cascata: itens de uma lista entram em sequência em vez de
 * todos ao mesmo tempo, que é o que faz o olho entender que aquilo é uma lista.
 */

type Sentido = 'sobe' | 'desce' | 'cresce' | 'surge';

type EntradaProps = {
  children: ReactNode;
  sentido?: Sentido;
  /** Posição na lista. Sem isto, entra imediatamente. */
  indice?: number;
  /** Atraso extra, somado ao da cascata. */
  atraso?: number;
  className?: string;
};

export function Entrada({
  children,
  sentido = 'sobe',
  indice,
  atraso = 0,
  className,
}: EntradaProps) {
  const espera = atraso + (indice === undefined ? 0 : atrasoEmCascata(indice));

  // A curva de entrada é a mesma para os quatro sentidos: o que muda é de onde
  // vem, não como freia. Trocar a curva junto com o sentido faria dois
  // elementos vizinhos parecerem ter pesos diferentes sem motivo.
  const animacao = {
    sobe: FadeInDown,
    desce: FadeInUp,
    cresce: ZoomIn,
    surge: FadeIn,
  }[sentido]
    .duration(sentido === 'surge' ? duracao.curta : duracao.media)
    .easing(curva.entrada)
    .delay(espera);

  return (
    <Animated.View entering={animacao} className={className}>
      {children}
    </Animated.View>
  );
}
