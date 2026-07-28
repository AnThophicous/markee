import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, {
  interpolateColor,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Toque } from '@/components/Toque';
import { curva, duracao, mola } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * A barra de baixo, no formato do Material 3.
 *
 * Existe por causa de um problema de CAMINHO, não de aparência. Postar uma
 * atividade num grupo custava sete toques: abrir, gaveta, Grupos, o grupo, o
 * mural, o compositor, escrever. O WhatsApp faz em três porque a lista de
 * conversas é a casa dele — não está atrás de uma gaveta.
 *
 * Com a barra, Grupos fica a UM toque de qualquer tela. A gaveta continua
 * existindo para o que é secundário (pastas, tags, lixeira): ali o custo de
 * abrir não importa, porque não é o que se faz dez vezes por dia.
 *
 * A PÍLULA QUE DESLIZA é a assinatura visual do Material 3, e ela informa: ao
 * escorregar de um item para o outro, mostra que são o mesmo nível de
 * navegação. Se ela apenas piscasse no destino, cada aba pareceria uma tela
 * separada — que é justamente a sensação que se quer evitar aqui.
 */

type Aba = {
  label: string;
  icone: keyof typeof Feather.glyphMap;
  href: Href;
  /** Prefixos de rota que acendem esta aba. */
  rotas: string[];
};

const ABAS: Aba[] = [
  { label: 'Notas', icone: 'file-text', href: '/', rotas: ['/', '/favorites', '/folder', '/tag', '/trash'] },
  { label: 'Grupos', icone: 'users', href: '/groups', rotas: ['/groups'] },
  { label: 'Buscar', icone: 'search', href: '/search', rotas: ['/search'] },
  { label: 'Perfil', icone: 'user', href: '/profile', rotas: ['/profile', '/friends', '/settings', '/u'] },
];

/**
 * Telas onde a barra NÃO aparece.
 *
 * São superfícies de trabalho: escrever uma nota, conversar, ler um post. Ali a
 * pessoa acabou de entrar e quer o conteúdo — uma barra ocupando o rodapé
 * rouba espaço, briga com o teclado e oferece sair de onde ela acabou de
 * chegar.
 *
 * Vai como expressão regular, e não como prefixo simples, porque o caminho da
 * conversa tem o id do grupo no meio: '/groups/<id>/room/<id>'. Um prefixo
 * simples não alcança o que vem depois da parte variável — foi assim que a
 * primeira versão deixou a barra aparecer dentro do chat, e o teste pegou.
 */
const SEM_BARRA = [
  /^\/note\//,
  /^\/groups\/[^/]+\/room\//,
  /^\/groups\/[^/]+\/post\//,
];

const ALTURA = 64;
const PILULA_ALTURA = 32;

/**
 * Qual aba a rota atual acende.
 *
 * A comparação é por prefixo porque as telas de dentro pertencem à mesma aba:
 * quem está lendo uma nota continua em "Notas", e apagar a marcação ali faria
 * a barra piscar para vazio ao entrar em qualquer detalhe.
 *
 * A raiz é caso à parte: como prefixo, '/' casaria com tudo.
 */
export function abaDaRota(caminho: string): number {
  if (SEM_BARRA.some((padrao) => padrao.test(caminho))) return -1;
  if (caminho === '/' || caminho === '') return 0;

  let melhor = -1;
  let tamanho = 0;
  ABAS.forEach((aba, i) => {
    for (const rota of aba.rotas) {
      if (rota === '/') continue;
      // O mais específico ganha: '/friends' não pode ser roubado por um
      // prefixo mais curto que também casasse.
      if ((caminho === rota || caminho.startsWith(rota + '/')) && rota.length > tamanho) {
        melhor = i;
        tamanho = rota.length;
      }
    }
  });
  return melhor;
}

export function NavigationBar() {
  const router = useRouter();
  const caminho = usePathname();
  const { tokens, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const ativa = abaDaRota(caminho);
  const larguraAba = width / ABAS.length;
  const larguraPilula = Math.min(64, larguraAba - 24);

  /**
   * Com o teclado aberto, a barra sai.
   *
   * O Android encolhe a janela quando o teclado sobe (`adjustResize`), então a
   * barra passaria a flutuar logo acima do teclado — 64 pixels de navegação
   * ocupando espaço bem na hora em que a pessoa precisa ver o que digita, e
   * oferecendo trocar de aba no meio de uma frase.
   *
   * Encolher a altura em vez de deixar de desenhar: assim o conteúdo acima
   * recupera o espaço com animação, em vez de dar um salto.
   */
  const teclado = useAnimatedKeyboard();

  const posicao = useSharedValue(Math.max(0, ativa));

  useEffect(() => {
    if (ativa < 0) return;
    // Mola, e não curva de tempo: trocar de aba duas vezes rápido faz a pílula
    // pegar a velocidade do movimento anterior em vez de recomeçar do zero.
    posicao.value = withSpring(ativa, mola.suave);
  }, [ativa, posicao]);

  const barra = useAnimatedStyle(() => {
    const escondida = teclado.height.value > 0;
    return {
      height: withTiming(escondida ? 0 : ALTURA, {
        duration: duracao.curta,
        easing: curva.padrao,
      }),
      opacity: withTiming(escondida ? 0 : 1, { duration: duracao.instante }),
    };
  });

  // A faixa reservada para a barra de gestos do sistema também some: com o
  // teclado aberto essa barra não está lá.
  const folga = useAnimatedStyle(() => ({
    paddingBottom: withTiming(teclado.height.value > 0 ? 0 : insets.bottom, {
      duration: duracao.curta,
      easing: curva.padrao,
    }),
  }));

  const pilula = useAnimatedStyle(() => ({
    transform: [
      { translateX: posicao.value * larguraAba + (larguraAba - larguraPilula) / 2 },
    ],
  }));

  // Fora das telas principais a barra não aparece: dentro de uma nota ou de uma
  // conversa ela roubaria espaço e ofereceria sair de onde a pessoa acabou de
  // entrar.
  if (ativa < 0) return null;

  return (
    <Animated.View
      style={[
        {
          backgroundColor: tokens.surfaceMid,
          borderTopWidth: mode === 'light' ? 1 : 0,
          borderTopColor: tokens.outlineVariant,
        },
        folga,
      ]}
    >
      <Animated.View style={[{ flexDirection: 'row', overflow: 'hidden' }, barra]}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: (ALTURA - PILULA_ALTURA) / 2 - 8,
              width: larguraPilula,
              height: PILULA_ALTURA,
              borderRadius: PILULA_ALTURA / 2,
              backgroundColor: tokens.primaryContainer,
            },
            pilula,
          ]}
        />

        {ABAS.map((aba, i) => (
          <ItemDaBarra
            key={aba.label}
            aba={aba}
            ativo={i === ativa}
            largura={larguraAba}
            onPress={() => {
              // `replace` e não `push`: as abas são irmãs, não uma dentro da
              // outra. Empilhar faria o botão voltar percorrer o histórico de
              // abas em vez de sair da tela.
              if (i !== ativa) router.replace(aba.href);
            }}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

function ItemDaBarra({
  aba,
  ativo,
  largura,
  onPress,
}: {
  aba: Aba;
  ativo: boolean;
  largura: number;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  const progresso = useDerivedValue(() =>
    withTiming(ativo ? 1 : 0, { duration: duracao.curta, easing: curva.padrao })
  );

  // O ícone sobe um pouco e cresce ao acender. É o que faz o item parecer
  // ganhar vida em vez de só trocar de cor.
  const iconeAnimado = useAnimatedStyle(() => ({
    transform: [{ translateY: -progresso.value * 2 }, { scale: 1 + progresso.value * 0.08 }],
  }));

  const rotuloAnimado = useAnimatedStyle(() => ({
    color: interpolateColor(progresso.value, [0, 1], [tokens.onSurfaceVariant, tokens.onSurface]),
  }));

  return (
    <Toque
      onPress={onPress}
      escala={0.94}
      style={{ width: largura, alignItems: 'center', justifyContent: 'center', gap: 4 }}
      accessibilityRole="tab"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={aba.label}
    >
      <Animated.View style={iconeAnimado}>
        <Feather
          name={aba.icone}
          size={21}
          // A cor do ícone não é interpolada porque o Feather não é animável:
          // ele recebe `color` como prop comum. A troca seca aqui passa
          // despercebida porque a pílula e a escala já carregam a transição.
          color={ativo ? tokens.onPrimaryContainer : tokens.onSurfaceVariant}
        />
      </Animated.View>
      <Animated.Text
        style={[{ fontSize: 11, fontWeight: ativo ? '700' : '500' }, rotuloAnimado]}
      >
        {aba.label}
      </Animated.Text>
    </Toque>
  );
}
