import { useCallback, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Toque } from '@/components/Toque';
import { mola } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import type { Category } from '@/types';
import { destinoAoSoltar, posicaoDoCartao, visiveis } from '../carousel-math';

/**
 * As categorias como cartões em perspectiva, num anel sem fim.
 *
 * Três aparecem: um à esquerda, o do meio — maior — e um à direita. Arrastar
 * gira o anel: o do meio vai para a esquerda, o da esquerda recua para trás e
 * reaparece pela direita, o da direita vem para o meio. Passar do último volta
 * ao primeiro pelo caminho mais curto; não existe fim de lista.
 *
 * A escolha do que fica maior não é enfeite: o tamanho é o que diz qual está
 * selecionada. Numa fileira de cartões iguais, a seleção precisaria de borda ou
 * de cor — dois recursos que já estão ocupados pela cor da própria categoria.
 *
 * A conta toda mora em `carousel-math.ts`, testada em separado. Aqui só há
 * gesto e desenho: aritmética de anel misturada com animação vira código onde
 * ninguém consegue mais dizer se o defeito é de cálculo ou de renderização.
 */

const ALTURA = 132;

type CategoryCarouselProps = {
  categorias: Category[];
  /** Contagem de notas por categoria, para o cartão dizer quanto tem dentro. */
  contagem?: Record<string, number>;
  /** Nulo = o cartão "Tudo", que sempre existe. */
  selecionada: string | null;
  onSelecionar: (id: string | null) => void;
  /** Segurar um cartão abre o gerenciador de categorias. */
  onGerenciar?: () => void;
};

/** O cartão de "todas as notas" entra na roda como se fosse uma categoria. */
type Item = { id: string | null; nome: string; cor: string; icone: string };

export function CategoryCarousel({
  categorias,
  contagem,
  selecionada,
  onSelecionar,
  onGerenciar,
}: CategoryCarouselProps) {
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();

  const itens: Item[] = [
    { id: null, nome: 'Tudo', cor: tokens.primary, icone: 'grid' },
    ...categorias.map((c) => ({ id: c.id, nome: c.name, cor: c.color, icone: c.icon })),
  ];

  const total = itens.length;
  const posicaoAtual = Math.max(0, itens.findIndex((i) => i.id === selecionada));
  const [ativo, setAtivo] = useState(posicaoAtual);

  // O passo é a distância entre um cartão e o seguinte. Um terço da largura
  // deixa os três visíveis com folga nas laterais.
  const passo = width * 0.34;

  const arrasto = useSharedValue(0);

  /**
   * O índice muda no JavaScript, mas o gesto vive na thread de animação. Sem o
   * `runOnJS` o estado nunca chegaria ao React, e o carrossel voltaria sozinho
   * para o cartão anterior ao soltar.
   */
  const assentar = useCallback(
    (destino: number) => {
      setAtivo(destino);
      onSelecionar(itens[destino]?.id ?? null);
    },
    [itens, onSelecionar]
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      arrasto.value = e.translationX;
    })
    .onEnd((e) => {
      const destino = destinoAoSoltar(ativo, e.translationX, e.velocityX, passo, total);
      // Volta a zero com mola: o cartão assenta no lugar em vez de encaixar
      // seco, e a mola pega a velocidade que o dedo deixou.
      arrasto.value = withSpring(0, mola.suave);
      if (destino !== ativo) runOnJS(assentar)(destino);
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={{ height: ALTURA }} className="justify-center">
        {visiveis(ativo, total).map((indice) => (
          <Cartao
            key={itens[indice].id ?? 'tudo'}
            item={itens[indice]}
            indice={indice}
            ativo={ativo}
            total={total}
            passo={passo}
            arrasto={arrasto}
            quantas={contagem?.[itens[indice].id ?? ''] ?? 0}
            onPress={() => assentar(indice)}
            // O cartão "Tudo" não é uma categoria de verdade e não se gerencia.
            onLongPress={itens[indice].id ? onGerenciar : undefined}
          />
        ))}
      </View>
    </GestureDetector>
  );
}

function Cartao({
  item,
  indice,
  ativo,
  total,
  passo,
  arrasto,
  quantas,
  onPress,
  onLongPress,
}: {
  item: Item;
  indice: number;
  ativo: number;
  total: number;
  passo: number;
  arrasto: SharedValue<number>;
  quantas: number;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { tokens } = useTheme();

  const estilo = useAnimatedStyle(() => {
    // O arrasto vira fração de passo: a 0,5 o carrossel está exatamente entre
    // duas posições, e todo cartão está entre dois estados.
    const deslocamento = -arrasto.value / passo;
    const p = posicaoDoCartao(indice, ativo, total, deslocamento);

    return {
      position: 'absolute',
      alignSelf: 'center',
      zIndex: p.camada,
      opacity: p.opacidade,
      transform: [
        { translateX: p.slot * passo },
        { scale: p.escala },
        // A rotação é o que dá a perspectiva: o cartão do lado fica de
        // esguelha, como se o anel virasse para dentro da tela. Sem ela, os
        // dos lados parecem só menores, e não mais longe.
        { rotateY: `${p.slot * -18}deg` },
      ],
    };
  });

  const naoSelecionado = indice !== ativo;

  return (
    <Animated.View style={estilo}>
      <Toque
        onPress={onPress}
        onLongPress={onLongPress}
        escala={0.95}
        style={{
          width: 150,
          height: 104,
          borderRadius: 28,
          padding: 14,
          justifyContent: 'space-between',
          // O cartão do meio ganha a cor da categoria; os dos lados ficam
          // neutros. Pintar todos deixaria a fileira parecendo um arco-íris e
          // tiraria da cor o papel de dizer qual está escolhida.
          backgroundColor: naoSelecionado ? tokens.surfaceMid : item.cor,
        }}
      >
        <Feather
          name={item.icone as keyof typeof Feather.glyphMap}
          size={22}
          color={naoSelecionado ? tokens.onSurfaceVariant : '#FFFFFF'}
        />
        <View>
          <AppText
            numberOfLines={1}
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: naoSelecionado ? tokens.onSurface : '#FFFFFF',
            }}
          >
            {item.nome}
          </AppText>
          <AppText
            style={{
              fontSize: 12,
              color: naoSelecionado ? tokens.onSurfaceVariant : 'rgba(255,255,255,0.85)',
            }}
          >
            {quantas === 1 ? '1 nota' : `${quantas} notas`}
          </AppText>
        </View>
      </Toque>
    </Animated.View>
  );
}
