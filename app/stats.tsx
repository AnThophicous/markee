import { Pressable, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { carregarPainel } from '@/features/stats/services/study-days.service';
import { MedalhaGrid } from '@/features/medals/components/MedalhaGrid';
import { intensidade } from '@/features/stats/streak';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * O painel de estudo.
 *
 * Três blocos e nada mais: ofensiva, mapa dos últimos três meses e os números
 * do total. Já quis colocar gráfico de barras por matéria, tempo médio por
 * sessão, previsão de quantas cartas vencem semana que vem. Todos ficaram de
 * fora pelo mesmo motivo: painel de estatística vira enfeite quando ninguém
 * consegue dizer o que fazer com o número. Estes três respondem perguntas de
 * verdade — "estou mantendo o hábito", "onde eu falhei", "quanto já fiz".
 */

const DIAS_DA_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function StatsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(24);
  const { data: painel, isLoading } = useQuery({ queryKey: ['painel'], queryFn: carregarPainel });

  if (isLoading || !painel) {
    return (
      <Screen>
        <ScreenHeader title="Seu estudo" showMenu={false} onBackPress={() => router.back()} />
      </Screen>
    );
  }

  const { ofensiva, mapa, pico } = painel;

  return (
    <Screen padBottom={false}>
      <ScreenHeader title="Seu estudo" showMenu={false} onBackPress={() => router.back()} />

      <ScrollView className="px-4" contentContainerStyle={{ paddingBottom: bottom }}>
        {/* --- a ofensiva ------------------------------------------------- */}
        {/* Toca e abre a tela da ofensiva, onde ficam as conquistas de dias e o
            protetor. Aqui continua só o número, que é o que o painel quer
            responder — o resto tem tela própria porque é o que se olha todo
            dia, e não junto com o balanço do mês. */}
        <Pressable
          onPress={() => router.push('/ofensiva')}
          className="mt-2 items-center rounded-3xl bg-surface-light py-7 active:opacity-80 dark:bg-surface-dark"
        >
          <View className="flex-row items-center gap-2">
            <Feather
              name="zap"
              size={26}
              // Apagada quando a ofensiva é zero: um raio aceso sobre o número
              // zero é uma comemoração de nada, e desanima em vez de motivar.
              color={ofensiva.atual > 0 ? '#F9AB00' : tokens.muted}
            />
            <AppText className="text-[44px] font-bold leading-[52px] text-ink-light dark:text-ink-dark">
              {ofensiva.atual}
            </AppText>
          </View>

          <AppText variant="body" className="mt-1">
            {ofensiva.atual === 1 ? 'dia seguido' : 'dias seguidos'}
          </AppText>

          {ofensiva.emRisco ? (
            <View className="mt-3 rounded-full bg-subtle-light px-3 py-1.5 dark:bg-subtle-dark">
              <AppText variant="small" style={{ color: '#F9AB00' }}>
                Estude hoje para não perder a sequência
              </AppText>
            </View>
          ) : ofensiva.recorde > ofensiva.atual ? (
            <AppText variant="small" className="mt-2">
              Seu recorde é {ofensiva.recorde}
            </AppText>
          ) : ofensiva.atual > 0 && ofensiva.atual === ofensiva.recorde ? (
            <AppText variant="small" className="mt-2">
              É o seu recorde
            </AppText>
          ) : null}

          <View className="mt-3 flex-row items-center gap-1">
            <AppText variant="small" style={{ color: tokens.accent }}>
              Ver conquistas
            </AppText>
            <Feather name="chevron-right" size={13} color={tokens.accent} />
          </View>
        </Pressable>

        {/* --- o mapa dos últimos três meses ----------------------------- */}
        <AppText variant="caption" className="mb-2 mt-6 px-1">
          Últimas 12 semanas
        </AppText>
        <View className="rounded-3xl bg-surface-light p-4 dark:bg-surface-dark">
          <View className="flex-row gap-1">
            <View className="mr-1 justify-between py-[1px]">
              {DIAS_DA_SEMANA.map((d, i) => (
                <AppText key={i} variant="small" className="h-[14px] text-[9px] leading-[14px]">
                  {i % 2 === 1 ? d : ' '}
                </AppText>
              ))}
            </View>

            {/*
              Uma coluna por semana, sete quadrados cada, na vertical — é o
              formato do GitHub, e é o formato certo: a leitura que importa
              ("faltei nas segundas") só aparece quando o dia da semana é uma
              linha fixa.
            */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-1">
                {Array.from({ length: mapa.length / 7 }, (_, semana) => (
                  <View key={semana} className="gap-1">
                    {mapa.slice(semana * 7, semana * 7 + 7).map((dia) => (
                      <View
                        key={dia.dia}
                        className="h-[14px] w-[14px] rounded-[3px]"
                        style={{
                          backgroundColor:
                            dia.peso > 0
                              ? tokens.accent
                              : tokens.hairline,
                          opacity: dia.peso > 0 ? 0.25 + intensidade(dia.peso, pico) * 0.1875 : 1,
                        }}
                        accessibilityLabel={`${dia.dia}: ${dia.peso} ${dia.peso === 1 ? 'atividade' : 'atividades'}`}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* --- os números ------------------------------------------------ */}
        <AppText variant="caption" className="mb-2 mt-6 px-1">
          No total
        </AppText>
        <View className="flex-row flex-wrap gap-3">
          <Numero icone="edit-3" valor={painel.totalDeNotas} rotulo="notas escritas" />
          <Numero icone="layers" valor={painel.totalDeCartas} rotulo="cartas revisadas" />
          <Numero
            icone="award"
            valor={painel.cartasMaduras}
            rotulo="cartas aprendidas"
            /*
              "Aprendida" é a carta com intervalo de três semanas ou mais. É o
              corte do Anki, e diz outra coisa que o total não diz: quantas
              você de fato SABE, em vez de quantas estão na fila.
            */
            dica={`de ${painel.cartasVivas}`}
          />
          <Numero icone="mic" valor={painel.totalDeMinutos} rotulo="minutos gravados" />
        </View>

        {/*
          As medalhas saem TODAS do banco local e são vistas só por quem
          conquistou: nada vai para o servidor, nada aparece no perfil que os
          outros veem. Um APK modificado consegue se dar todas elas, e o estrago
          é zero — o efeito não sai do aparelho de quem trapaceou.
        */}
        <View className="mt-6">
          <MedalhaGrid
            numeros={{
              ofensiva: ofensiva.atual,
              recordeDeOfensiva: ofensiva.recorde,
              cartasRevisadas: painel.totalDeCartas,
              cartasMaduras: painel.cartasMaduras,
              notasEscritas: painel.totalDeNotas,
              minutosGravados: painel.totalDeMinutos,
            }}
          />
        </View>

        {painel.cartasNaSemana > 0 ? (
          <AppText variant="caption" className="mt-4 px-1 text-center">
            {painel.cartasNaSemana}{' '}
            {painel.cartasNaSemana === 1 ? 'carta revisada' : 'cartas revisadas'} nos últimos 7 dias
          </AppText>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Numero({
  icone,
  valor,
  rotulo,
  dica,
}: {
  icone: keyof typeof Feather.glyphMap;
  valor: number;
  rotulo: string;
  dica?: string;
}) {
  const { tokens } = useTheme();

  return (
    <View className="min-w-[45%] flex-1 rounded-3xl bg-surface-light p-4 dark:bg-surface-dark">
      <Feather name={icone} size={17} color={tokens.muted} />
      <View className="mt-2 flex-row items-baseline gap-1.5">
        <AppText className="text-[26px] font-bold leading-[30px] text-ink-light dark:text-ink-dark">
          {valor}
        </AppText>
        {dica ? <AppText variant="small">{dica}</AppText> : null}
      </View>
      <AppText variant="small">{rotulo}</AppText>
    </View>
  );
}
