import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Toque } from '@/components/Toque';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import {
  MODELOS,
  ORDEM,
  cabeNaMemoria,
  emPalavras,
  estimarSegundos,
  ramNecessaria,
  tamanhoEmPalavras,
  type IdDeModelo,
} from '@/features/transcription/whisper-local';
import {
  apagarModelo,
  baixarModelo,
  estadoDoModelo,
  ramDoAparelho,
} from '@/features/transcription/services/whisper-model.service';
import { useBottomInset } from '@/hooks/useBottomInset';
import { avisar } from '@/services/avisos';
import { mola } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Transcrever sem internet.
 *
 * Esta tela existe por um motivo bem concreto: o modelo tem entre 31 MB e meio
 * GIGA, e nada disso cabe no APK. Sem um lugar para baixar, a transcrição no
 * aparelho seria código morto — presente no pacote e inalcançável.
 *
 * O que ela mais faz, porém, não é baixar: é AVISAR ANTES. Um telefone comum
 * roda o modelo Caprichado mais devagar do que a aula acontece, e o momento de
 * descobrir isso é aqui, olhando o número, e não quarenta minutos depois de
 * mandar transcrever a aula da prova. Por isso cada cartão mostra o tempo
 * estimado para uma aula de cinquenta minutos, e o que não cabe na memória
 * aparece desligado com o motivo escrito, em vez de simplesmente sumir.
 */

/** A régua das estimativas: uma aula comum. */
const AULA = 50 * 60;

export default function TranscriptionScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(24);

  const ram = ramDoAparelho();
  const [estados, setEstados] = useState(() => ORDEM.map(estadoDoModelo));
  const [baixando, setBaixando] = useState<IdDeModelo | null>(null);
  const [fracao, setFracao] = useState(0);

  // Guardado em ref, e não em estado: cancelar não redesenha nada sozinho, e
  // trocar isso por estado faria o botão de cancelar se recriar a cada quadro
  // da barra de progresso.
  const corte = useRef<AbortController | null>(null);

  const reler = useCallback(() => setEstados(ORDEM.map(estadoDoModelo)), []);

  // O download continua se a pessoa sair da tela no meio; o que não pode é a
  // barra tentar desenhar depois que a tela morreu.
  useEffect(() => () => corte.current?.abort(), []);

  const baixar = async (id: IdDeModelo) => {
    if (baixando) return;
    const controle = new AbortController();
    corte.current = controle;
    setBaixando(id);
    setFracao(0);

    try {
      await baixarModelo(id, {
        sinal: controle.signal,
        onProgresso: (p) => setFracao(p.fracao),
      });
      avisar(`${MODELOS[id].nome} pronto para uso.`, 'ok');
    } catch (erro) {
      // Cancelamento é escolha da pessoa, não falha: avisar seria contar de
      // volta o que ela acabou de mandar fazer.
      if (!controle.signal.aborted) {
        avisar(erro instanceof Error ? erro.message : 'Não consegui baixar o modelo.');
      }
    } finally {
      corte.current = null;
      setBaixando(null);
      setFracao(0);
      reler();
    }
  };

  const apagar = (id: IdDeModelo) => {
    apagarModelo(id);
    reler();
    avisar(`${MODELOS[id].nome} removido.`, 'ok');
  };

  const instalados = estados.filter((e) => e.instalado).length;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <ScreenHeader
        title="Transcrição sem internet"
        subtitle={instalados === 0 ? 'Nenhum modelo baixado' : `${instalados} baixado(s)`}
        showMenu={false}
        onBackPress={() => router.back()}
      />

      <ScrollView className="px-4 pt-2" contentContainerStyle={{ paddingBottom: bottom }}>
        <View
          style={{ backgroundColor: tokens.surfaceLow, borderRadius: 28 }}
          className="mb-4 px-4 py-4"
        >
          <AppText variant="bodyEmphasis">Como isto funciona</AppText>
          <AppText variant="caption" className="mt-2">
            Normalmente a transcrição roda nos nossos servidores: sai melhor e é rápida. Baixando um
            modelo aqui, o aparelho passa a conseguir transcrever sozinho quando os créditos acabam
            ou você está sem internet.
          </AppText>
          <AppText variant="caption" className="mt-2">
            No aparelho a transcrição erra mais e demora mais — o modelo é bem menor que o do
            servidor. Vale como reserva, não como troca.
          </AppText>
        </View>

        {ORDEM.map((id) => {
          const estado = estados.find((e) => e.modelo.id === id)!;
          const modelo = MODELOS[id];
          const cabe = cabeNaMemoria(modelo, ram);
          const espera = estimarSegundos(AULA, modelo);
          const lento = espera > AULA;

          return (
            <Animated.View
              key={id}
              layout={LinearTransition.springify().damping(mola.suave.damping)}
              style={{
                backgroundColor: tokens.surfaceLow,
                borderRadius: 28,
                // Só o que não cabe fica apagado. Apagar o que já está baixado
                // faria a pessoa achar que perdeu o download.
                opacity: cabe ? 1 : 0.55,
              }}
              className="mb-3 px-4 py-4"
            >
              <View className="flex-row items-center gap-3">
                <View
                  style={{ backgroundColor: estado.instalado ? tokens.primary : tokens.surfaceMid }}
                  className="h-10 w-10 items-center justify-center rounded-full"
                >
                  <Feather
                    name={estado.instalado ? 'check' : 'download'}
                    size={18}
                    color={estado.instalado ? tokens.onPrimary : tokens.onSurfaceVariant}
                  />
                </View>

                <View className="flex-1">
                  <AppText variant="bodyEmphasis">{modelo.nome}</AppText>
                  <AppText variant="small">
                    {tamanhoEmPalavras(modelo.bytes)} · aula de 50 min em ~{emPalavras(espera)}
                  </AppText>
                </View>
              </View>

              {lento && cabe ? (
                <AppText variant="caption" className="mt-2.5">
                  Demora mais do que a própria aula. Dá para deixar rodando com a tela apagada.
                </AppText>
              ) : null}

              {!cabe ? (
                <AppText variant="caption" className="mt-2.5">
                  Precisa de cerca de {tamanhoEmPalavras(ramNecessaria(modelo))} de memória e este
                  aparelho tem {tamanhoEmPalavras(ram)}. Rodar assim faria o app fechar no meio da
                  transcrição.
                </AppText>
              ) : null}

              {baixando === id ? (
                <Animated.View entering={FadeIn} className="mt-3">
                  <View
                    style={{ backgroundColor: tokens.surfaceMid }}
                    className="h-1.5 overflow-hidden rounded-full"
                  >
                    <View
                      style={{
                        backgroundColor: tokens.primary,
                        width: `${Math.round(fracao * 100)}%`,
                      }}
                      className="h-full rounded-full"
                    />
                  </View>
                  <View className="mt-2 flex-row items-center justify-between">
                    <AppText variant="small">
                      {Math.round(fracao * 100)}% de {tamanhoEmPalavras(modelo.bytes)}
                    </AppText>
                    <Toque onPress={() => corte.current?.abort()} className="px-2 py-1">
                      <AppText variant="small" style={{ color: tokens.primary }}>
                        Cancelar
                      </AppText>
                    </Toque>
                  </View>
                </Animated.View>
              ) : estado.instalado ? (
                <Button
                  label="Remover"
                  variant="danger"
                  className="mt-3 self-start px-0"
                  onPress={() => apagar(id)}
                />
              ) : (
                <Button
                  label={cabe ? 'Baixar' : 'Não cabe neste aparelho'}
                  variant={cabe ? 'secondary' : 'ghost'}
                  disabled={!cabe || baixando !== null}
                  className="mt-3 self-start"
                  onPress={() => baixar(id)}
                />
              )}
            </Animated.View>
          );
        })}

        <AppText variant="caption" className="mt-2 px-1">
          O download é grande: use wi-fi. O arquivo fica guardado no aparelho e não baixa de novo.
        </AppText>
      </ScrollView>
    </View>
  );
}
