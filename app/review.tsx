import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useFilaDeHoje, useResponderCarta } from '@/features/review/hooks/useCards';
import { previsao, type Resposta } from '@/features/review/sm2';
import type { CartaDeRevisao } from '@/features/review/services/cards.service';
import { useBottomInset } from '@/hooks/useBottomInset';
import { curva, duracao } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * A sessão de revisão.
 *
 * Uma carta por vez, tela cheia. Lista de cartas seria mais fácil de escrever e
 * destruiria o método: o valor da revisão espaçada está em TENTAR LEMBRAR antes
 * de ver a resposta, e uma lista mostra a resposta da carta seguinte no canto
 * da tela enquanto você ainda pensa na atual.
 */

const BOTOES: { resposta: Resposta; rotulo: string; cor: 'erro' | 'aviso' | 'ok' | 'otimo' }[] = [
  { resposta: 'errei', rotulo: 'Errei', cor: 'erro' },
  { resposta: 'dificil', rotulo: 'Difícil', cor: 'aviso' },
  { resposta: 'bom', rotulo: 'Bom', cor: 'ok' },
  { resposta: 'facil', rotulo: 'Fácil', cor: 'otimo' },
];

export default function ReviewScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(24);
  const { data: fila, isLoading } = useFilaDeHoje();
  const responder = useResponderCarta();

  const [indice, setIndice] = useState(0);
  const [virada, setVirada] = useState(false);
  const [acertos, setAcertos] = useState(0);

  const carta: CartaDeRevisao | undefined = fila?.[indice];
  const total = fila?.length ?? 0;
  const acabou = !isLoading && (total === 0 || indice >= total);

  const cores: Record<string, string> = useMemo(
    () => ({
      erro: tokens.danger,
      aviso: '#F9AB00',
      ok: tokens.accent,
      otimo: '#1E8E3E',
    }),
    [tokens]
  );

  function avancar(resposta: Resposta) {
    if (!carta) return;
    responder.mutate({ carta, resposta });
    if (resposta !== 'errei') setAcertos((n) => n + 1);
    setVirada(false);
    setIndice((n) => n + 1);
  }

  if (acabou) {
    return (
      <Screen>
        <ScreenHeader title="Revisão" showMenu={false} onBackPress={() => router.back()} />
        {total === 0 ? (
          <EmptyState
            icon="check-circle"
            title="Nada para revisar"
            subtitle="Marque trechos das suas notas como carta e eles aparecem aqui no dia certo."
          />
        ) : (
          <Fim total={total} acertos={acertos} onSair={() => router.back()} />
        )}
      </Screen>
    );
  }

  return (
    <Screen padBottom={false}>
      <ScreenHeader
        title="Revisão"
        subtitle={`${indice + 1} de ${total}`}
        showMenu={false}
        onBackPress={() => router.back()}
      />

      <Progresso feito={indice} total={total} cor={tokens.accent} />

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 24, flexGrow: 1 }}
      >
        <View className="flex-1 justify-center">
          <AppText variant="small" className="mb-3 text-center uppercase">
            {carta?.repeticoes === 0 ? 'Carta nova' : `Vista ${carta?.repeticoes}×`}
          </AppText>

          <AppText variant="title" className="text-center">
            {carta?.frente}
          </AppText>

          {virada ? (
            <Animated.View
              entering={FadeIn.duration(duracao.curta)}
              className="mt-8 rounded-3xl bg-surface-light p-5 dark:bg-surface-dark"
            >
              <AppText variant="body" className="text-center">
                {carta?.verso}
              </AppText>
            </Animated.View>
          ) : null}
        </View>
      </ScrollView>

      <View className="px-5" style={{ paddingBottom: bottom }}>
        {virada ? (
          <Animated.View entering={FadeIn.duration(duracao.instante)} className="flex-row gap-2">
            {BOTOES.map(({ resposta, rotulo, cor }) => (
              <Pressable
                key={resposta}
                onPress={() => avancar(resposta)}
                className="flex-1 items-center rounded-2xl py-3 active:opacity-70"
                style={{ backgroundColor: cores[cor] + '22' }}
                accessibilityRole="button"
                accessibilityLabel={`${rotulo}, volta ${carta ? previsao(carta)[resposta] : ''}`}
              >
                <AppText variant="bodyEmphasis" style={{ color: cores[cor] }}>
                  {rotulo}
                </AppText>
                {/*
                  O intervalo aparece ANTES do toque, de propósito. É o que faz a
                  pessoa responder com honestidade: quando "Fácil" anuncia
                  "3 meses", ninguém aperta fácil por preguiça.
                */}
                <AppText variant="small" style={{ color: cores[cor] }}>
                  {carta ? previsao(carta)[resposta] : ''}
                </AppText>
              </Pressable>
            ))}
          </Animated.View>
        ) : (
          <Pressable
            onPress={() => setVirada(true)}
            className="items-center rounded-2xl bg-accent py-4 active:opacity-80"
            accessibilityRole="button"
          >
            <AppText variant="bodyEmphasis" className="text-white">
              Mostrar resposta
            </AppText>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

function Progresso({ feito, total, cor }: { feito: number; total: number; cor: string }) {
  const largura = useSharedValue(0);
  useEffect(() => {
    largura.value = withTiming(total > 0 ? feito / total : 0, {
      duration: duracao.media,
      easing: curva.padrao,
    });
  }, [feito, total, largura]);

  const estilo = useAnimatedStyle(() => ({ width: `${largura.value * 100}%` }));

  return (
    <View className="mx-5 h-1 overflow-hidden rounded-full bg-hairline-light dark:bg-hairline-dark">
      <Animated.View style={[estilo, { backgroundColor: cor }]} className="h-full rounded-full" />
    </View>
  );
}

function Fim({ total, acertos, onSair }: { total: number; acertos: number; onSair: () => void }) {
  const { tokens } = useTheme();
  const porcento = total > 0 ? Math.round((acertos / total) * 100) : 0;

  return (
    <Animated.View entering={FadeIn.duration(duracao.media)} exiting={FadeOut} className="flex-1 items-center justify-center px-8">
      <View
        className="mb-6 h-24 w-24 items-center justify-center rounded-full"
        style={{ backgroundColor: tokens.accent + '22' }}
      >
        <Feather name="check" size={44} color={tokens.accent} />
      </View>

      <AppText variant="title" className="text-center">
        Sessão concluída
      </AppText>
      <AppText variant="caption" className="mt-2 text-center">
        {total} {total === 1 ? 'carta revisada' : 'cartas revisadas'} · {porcento}% de acerto
      </AppText>

      <Pressable
        onPress={onSair}
        className="mt-8 rounded-2xl bg-accent px-8 py-3.5 active:opacity-80"
        accessibilityRole="button"
      >
        <AppText variant="bodyEmphasis" className="text-white">
          Voltar
        </AppText>
      </Pressable>
    </Animated.View>
  );
}
