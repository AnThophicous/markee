import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { Toque } from '@/components/Toque';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useCreateNote } from '@/features/notes/hooks/useNoteMutations';
import { classificarAula, montarNota } from '@/features/transcription/services/transcription.service';
import { relogio, SEGUNDOS_POR_PEDACO } from '@/features/transcription/gravacao';
import { useGravacao } from '@/features/transcription/hooks/useGravacao';
import { useBottomInset } from '@/hooks/useBottomInset';
import { avisar } from '@/services/avisos';
import { curva, duracao } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Gravar a aula.
 *
 * A tela mostra três coisas e esconde o resto: o tempo, se está gravando, e
 * quantos pedaços já viraram texto. O que está por baixo — corte a cada dois
 * minutos, fila em ordem, três tentativas por pedaço — não é assunto de quem
 * está assistindo aula.
 *
 * O que ela NÃO faz é prometer que a nota sai pronta no segundo em que o
 * professor cala a boca. O último pedaço ainda está subindo, e dizer isso é
 * mais honesto do que uma roda girando sem explicação.
 */
export default function RecordScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(24);
  const criarNota = useCreateNote();
  const [salvando, setSalvando] = useState(false);

  const {
    estado,
    segundos,
    progresso,
    texto,
    comecar,
    pausar,
    retomar,
    terminar,
    tentarDeNovo,
  } = useGravacao();

  const pulso = useSharedValue(1);
  useEffect(() => {
    pulso.value =
      estado === 'gravando'
        ? withRepeat(withTiming(1.18, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true)
        : withTiming(1, { duration: duracao.curta, easing: curva.padrao });
  }, [estado, pulso]);

  const bolha = useAnimatedStyle(() => ({ transform: [{ scale: pulso.value }] }));

  async function salvarComoNota() {
    if (!texto.trim()) {
      avisar('Não há texto transcrito para salvar.', 'erro');
      return;
    }

    setSalvando(true);
    try {
      // A classificação separa matéria de tarefa e de conversa fiada. Se ela
      // falhar, `classificarAula` devolve a transcrição inteira como conteúdo —
      // a pessoa gravou a aula e pagou pelos minutos; ficar sem a nota porque o
      // segundo passo falhou seria cobrar por trabalho não entregue.
      const trechos = await classificarAula(texto);
      const nota = await criarNota.mutateAsync({
        title: `Aula de ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}`,
        content: montarNota(trechos),
      });
      router.replace(`/note/${nota.id}`);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui montar a nota.', 'erro');
    } finally {
      setSalvando(false);
    }
  }

  const parado = estado === 'parado';
  const ativo = estado === 'gravando' || estado === 'pausado';
  const acabou = estado === 'pronto';

  return (
    <Screen padBottom={false}>
      <ScreenHeader
        title="Gravar aula"
        subtitle={ativo ? `Pedaço ${Math.floor(segundos / SEGUNDOS_POR_PEDACO) + 1}` : undefined}
        showMenu={false}
        onBackPress={() => router.back()}
      />

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 items-center justify-center py-8">
          <Animated.View
            style={[
              bolha,
              {
                backgroundColor:
                  estado === 'gravando' ? tokens.danger + '22' : tokens.accent + '18',
              },
            ]}
            className="h-40 w-40 items-center justify-center rounded-full"
          >
            <Feather
              name={estado === 'pausado' ? 'pause' : acabou ? 'check' : 'mic'}
              size={48}
              color={estado === 'gravando' ? tokens.danger : tokens.accent}
            />
          </Animated.View>

          <AppText className="mt-7 text-[40px] font-bold leading-[46px] text-ink-light dark:text-ink-dark">
            {relogio(segundos)}
          </AppText>

          <AppText variant="caption" className="mt-1">
            {parado
              ? 'Toque para começar'
              : estado === 'gravando'
                ? 'Gravando'
                : estado === 'pausado'
                  ? 'Pausado'
                  : estado === 'terminando'
                    ? 'Fechando o último pedaço…'
                    : 'Gravação encerrada'}
          </AppText>

          {/* O progresso da transcrição, que corre em paralelo com a aula. */}
          {progresso.total > 0 ? (
            <Animated.View entering={FadeIn.duration(duracao.curta)} className="mt-8 w-full">
              <View className="mb-2 flex-row items-center justify-between">
                <AppText variant="small">
                  {progresso.prontos} de {progresso.total} {progresso.total === 1 ? 'trecho' : 'trechos'}{' '}
                  transcritos
                </AppText>
                {progresso.falharam > 0 ? (
                  <Pressable onPress={tentarDeNovo} hitSlop={8}>
                    <AppText variant="small" style={{ color: tokens.danger }}>
                      {progresso.falharam} falhou · tentar de novo
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
              <View className="h-1.5 overflow-hidden rounded-full bg-hairline-light dark:bg-hairline-dark">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(progresso.fracao * 100)}%`,
                    backgroundColor: tokens.accent,
                  }}
                />
              </View>
            </Animated.View>
          ) : null}

          {acabou && texto.trim() ? (
            <View className="mt-6 w-full rounded-2xl bg-surface-light p-4 dark:bg-surface-dark">
              <AppText variant="small" className="mb-1.5 uppercase">
                Prévia
              </AppText>
              <AppText variant="caption" numberOfLines={6}>
                {texto}
              </AppText>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View className="gap-2 px-5" style={{ paddingBottom: bottom }}>
        {parado ? (
          <Toque
            onPress={comecar}
            className="items-center rounded-2xl bg-accent py-4"
            accessibilityRole="button"
          >
            <AppText variant="bodyEmphasis" className="text-white">
              Começar a gravar
            </AppText>
          </Toque>
        ) : ativo ? (
          <View className="flex-row gap-2">
            <Toque
              onPress={estado === 'gravando' ? pausar : retomar}
              className="flex-1 items-center rounded-2xl bg-subtle-light py-4 dark:bg-subtle-dark"
              accessibilityRole="button"
            >
              <AppText variant="bodyEmphasis">
                {estado === 'gravando' ? 'Pausar' : 'Retomar'}
              </AppText>
            </Toque>
            <Toque
              onPress={terminar}
              className="flex-1 items-center rounded-2xl py-4"
              style={{ backgroundColor: tokens.danger }}
              accessibilityRole="button"
            >
              <AppText variant="bodyEmphasis" className="text-white">
                Terminar
              </AppText>
            </Toque>
          </View>
        ) : acabou ? (
          <>
            <Toque
              onPress={salvarComoNota}
              // Enquanto houver pedaço na fila, salvar agora produziria uma nota
              // pela metade. O botão diz o que está faltando em vez de só ficar
              // apagado — "espere" sem motivo é o que faz apertar de novo.
              disabled={progresso.trabalhando || salvando || !texto.trim()}
              className="items-center rounded-2xl bg-accent py-4 disabled:opacity-40"
              accessibilityRole="button"
            >
              <AppText variant="bodyEmphasis" className="text-white">
                {progresso.trabalhando
                  ? 'Terminando de transcrever…'
                  : salvando
                    ? 'Montando a nota…'
                    : 'Virar nota'}
              </AppText>
            </Toque>
            <Toque
              onPress={() => router.back()}
              className="items-center rounded-2xl py-3"
              accessibilityRole="button"
            >
              <AppText variant="caption">Descartar</AppText>
            </Toque>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
