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
/**
 * Quanto dura um ciclo de cada efeito, em milissegundos.
 *
 * A varredura tem o ciclo mais longo de todos porque a maior parte dele é
 * PAUSA: o brilho cruza o banner no primeiro quarto e o resto do tempo não há
 * nada acontecendo.
 */
const DURACAO: Record<VisualEffect, number> = {
  none: 0,
  shine: 3400,
  glow: 5200,
  sweep: 4200,
  pulse: 2200,
  shift: 5200,
  spin: 12000,
  aurora: 9000,
  holo: 5000,
  neon: 1800,
  ondas: 4000,
  metal: 3000,
  veludo: 4600,
};

/**
 * Quem corre sempre para o mesmo lado.
 *
 * A faixa some de um lado e reaparece do outro; giro que desgira e metal
 * escovado que volta de ré parecem defeito. Todos os outros ficam melhores indo
 * e voltando, com aceleração suave nas pontas.
 */
const SEM_VOLTA = new Set<VisualEffect>(['sweep', 'spin', 'metal']);

export function ThemeEffect({ effect, width, height }: ThemeEffectProps) {
  const progress = useSharedValue(0);
  // A aurora precisa de duas manchas andando em ritmos diferentes. Com um
  // relógio só elas se moveriam em espelho, o que lê como duas formas presas
  // uma na outra — exatamente o contrário do que a aurora deveria parecer.
  const segundo = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    segundo.value = 0;
    if (effect === 'none') return;

    const vaiEVolta = !SEM_VOLTA.has(effect);

    progress.value = withRepeat(
      withTiming(1, {
        duration: DURACAO[effect],
        easing: vaiEVolta ? Easing.inOut(Easing.sin) : Easing.linear,
      }),
      -1,
      vaiEVolta
    );

    if (effect === 'aurora') {
      // Fora de proporção inteira com o primeiro (1,63x), de propósito: em 2x
      // as duas manchas se reencontrariam na mesma posição a cada ciclo e o
      // desenho ficaria periódico o bastante para o olho perceber a repetição.
      segundo.value = withRepeat(
        withTiming(1, { duration: Math.round(DURACAO[effect] * 1.63), easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
    }
  }, [effect, progress, segundo]);

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

  /* ------------------------------------------------------------ os novos */

  const auroraUm = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0.28, 0.62, 0.28]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-width * 0.25, width * 0.35]) },
      { translateY: interpolate(progress.value, [0, 1], [-height * 0.35, height * 0.15]) },
      { scale: interpolate(progress.value, [0, 1], [1, 1.35]) },
    ],
  }));

  const auroraDois = useAnimatedStyle(() => ({
    opacity: interpolate(segundo.value, [0, 0.5, 1], [0.5, 0.18, 0.5]),
    transform: [
      { translateX: interpolate(segundo.value, [0, 1], [width * 0.5, -width * 0.1]) },
      { translateY: interpolate(segundo.value, [0, 1], [height * 0.3, -height * 0.2]) },
      { scale: interpolate(segundo.value, [0, 1], [1.3, 0.95]) },
    ],
  }));

  /**
   * O holograma.
   *
   * O arco-íris desliza E gira um pouco ao mesmo tempo. Só deslizar pareceria
   * uma bandeira passando; a inclinação mudando junto é o que dá a impressão de
   * que a luz está batendo em ângulos diferentes numa superfície parada.
   */
  const holoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0.45, 0.7, 0.45]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-width * 0.5, width * 0.5]) },
      { rotate: `${interpolate(progress.value, [0, 1], [-12, 12])}deg` },
    ],
  }));

  const neonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.35, 1]),
  }));

  const neonInterno = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.1, 0.45]),
  }));

  /**
   * As ondas: três faixas, e cada uma com o seu próprio percurso.
   *
   * Escritas uma a uma, e não geradas por uma função que devolve o estilo: hook
   * dentro de função auxiliar é "Rendered fewer hooks than expected" esperando
   * acontecer, e o linter para o build por causa disso — com razão.
   *
   * O que faz parecer água é justamente elas NÃO andarem juntas. Mesma origem e
   * mesmo tempo, mas alturas e opacidades em oposição: subindo em bloco, três
   * faixas paralelas seriam uma barra atravessando o cartão.
   */
  const ondaUm = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-height * 0.15, height * 0.35]) }],
    opacity: interpolate(progress.value, [0, 1], [0.5, 0.14]),
  }));

  const ondaDois = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [height * 0.18, -height * 0.28]) }],
    opacity: interpolate(progress.value, [0, 1], [0.18, 0.5]),
  }));

  const ondaTres = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-height * 0.05, height * 0.55]) }],
    opacity: interpolate(progress.value, [0, 1], [0.34, 0.1]),
  }));

  const metalStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-width * 1.4, width * 1.4]) }],
  }));

  /**
   * O veludo, que é o único efeito em que a graça está no que ESCURECE.
   *
   * Veludo muda de tom conforme o pelo se deita para um lado ou para o outro:
   * o mesmo tecido parece claro de um ângulo e escuro do outro. Por isso são
   * duas camadas em oposição — quando uma clareia, a outra escurece — em vez de
   * um brilho só aparecendo e sumindo, que seria mais um "pulso".
   */
  const veludoClaro = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.55, 0.05]),
  }));

  const veludoEscuro = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.05, 0.5]),
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

  if (effect === 'aurora') {
    // Manchas bem maiores que o cartão: só assim o que aparece é o MEIO delas,
    // que é macio. Mancha pequena mostra a borda, e borda de gradiente circular
    // lê como um círculo desenhado, não como luz.
    const bolha = width * 1.1;
    return (
      <View pointerEvents="none" style={[FILL, { overflow: 'hidden' }]}>
        <Animated.View
          style={[
            { position: 'absolute', left: -bolha * 0.3, top: -bolha * 0.45, width: bolha, height: bolha, borderRadius: bolha, overflow: 'hidden' },
            auroraUm,
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0)']}
            locations={[0, 0.45, 1]}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>

        <Animated.View
          style={[
            { position: 'absolute', left: -bolha * 0.15, top: -bolha * 0.3, width: bolha, height: bolha, borderRadius: bolha, overflow: 'hidden' },
            auroraDois,
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.75)']}
            locations={[0, 0.5, 1]}
            start={{ x: 1, y: 0.2 }}
            end={{ x: 0.2, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    );
  }

  if (effect === 'holo') {
    return (
      <View pointerEvents="none" style={[FILL, { overflow: 'hidden' }]}>
        <Animated.View
          style={[
            // Bem mais largo e mais alto que o cartão: ele gira, e sem a sobra
            // os cantos entrariam na área visível no meio da inclinação.
            { position: 'absolute', left: -width * 0.75, top: -height * 0.6, width: width * 2.5, height: height * 2.2 },
            holoStyle,
          ]}
        >
          {/* As cores do holograma são as do arco-íris, mas fracas e sem o
              vermelho puro: sobre um fundo já colorido, saturação cheia vira
              sujeira em vez de brilho. */}
          <LinearGradient
            colors={[
              'rgba(255,255,255,0)',
              'rgba(255,120,180,0.45)',
              'rgba(255,214,120,0.45)',
              'rgba(140,255,190,0.45)',
              'rgba(120,190,255,0.45)',
              'rgba(190,140,255,0.45)',
              'rgba(255,255,255,0)',
            ]}
            locations={[0, 0.16, 0.33, 0.5, 0.67, 0.84, 1]}
            start={{ x: 0, y: 0.35 }}
            end={{ x: 1, y: 0.65 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    );
  }

  if (effect === 'neon') {
    // Dois contornos concêntricos em vez de uma sombra colorida: `shadowColor`
    // não pinta no Android (lá a sombra é a elevation, e ela é sempre cinza),
    // então um halo feito de sombra apareceria só no iOS e o efeito pareceria
    // quebrado justo no aparelho que a maioria usa.
    return (
      <View pointerEvents="none" style={FILL}>
        <Animated.View
          style={[
            { position: 'absolute', top: 2, left: 2, right: 2, bottom: 2, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.95)' },
            neonStyle,
          ]}
        />
        <Animated.View
          style={[
            { position: 'absolute', top: 7, left: 7, right: 7, bottom: 7, borderRadius: 14, borderWidth: 3, borderColor: 'rgba(255,255,255,0.75)' },
            neonInterno,
          ]}
        />
      </View>
    );
  }

  if (effect === 'ondas') {
    const faixa = Math.max(18, height * 0.3);
    const banda = { position: 'absolute' as const, left: -width * 0.1, width: width * 1.2, height: faixa };
    return (
      <View pointerEvents="none" style={[FILL, { overflow: 'hidden' }]}>
        <Animated.View style={[banda, { top: height * 0.1 }, ondaUm]}>
          <Onda />
        </Animated.View>
        <Animated.View style={[banda, { top: height * 0.42 }, ondaDois]}>
          <Onda />
        </Animated.View>
        <Animated.View style={[banda, { top: height * 0.68 }, ondaTres]}>
          <Onda />
        </Animated.View>
      </View>
    );
  }

  if (effect === 'metal') {
    return (
      <View pointerEvents="none" style={[FILL, { overflow: 'hidden' }]}>
        <Animated.View
          style={[
            { position: 'absolute', top: -height * 0.2, height: height * 1.4, width: width * 0.55 },
            metalStyle,
          ]}
        >
          {/* O que separa metal de "varredura" é a dureza: a luz vai a 1 e cai
              a zero em poucos por cento, com uma sombra colada do lado. Um
              degradê macio no lugar disso daria de novo o brilho de cetim. */}
          <LinearGradient
            colors={[
              'rgba(0,0,0,0)',
              'rgba(0,0,0,0.28)',
              'rgba(255,255,255,0.15)',
              'rgba(255,255,255,1)',
              'rgba(255,255,255,0.15)',
              'rgba(0,0,0,0.28)',
              'rgba(0,0,0,0)',
            ]}
            locations={[0, 0.32, 0.46, 0.5, 0.54, 0.68, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.25 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    );
  }

  if (effect === 'veludo') {
    return (
      <View pointerEvents="none" style={[FILL, { overflow: 'hidden' }]}>
        <Animated.View style={[FILL, veludoClaro]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.12)', 'rgba(0,0,0,0.22)']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.05, y: 0.1 }}
            end={{ x: 0.95, y: 0.95 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
        <Animated.View style={[FILL, veludoEscuro]}>
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.7)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0.05, y: 0.1 }}
            end={{ x: 0.95, y: 0.95 }}
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

/** Uma faixa de água: transparente nas pontas, cheia no meio. */
function Onda() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
      locations={[0, 0.5, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ flex: 1 }}
    />
  );
}
