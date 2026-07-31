import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { useIsPro } from '@/features/billing/hooks/useMyUsage';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import {
  DIAS_POR_PROTETOR,
  marcosDa,
  proximoMarco,
  textoDoProtetor,
} from '@/features/stats/conquistas';
import { conferirProtetor, semanaAtual } from '@/features/stats/services/protetor.service';
import { carregarPainel } from '@/features/stats/services/study-days.service';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

const LETRAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * A ofensiva, em tela própria.
 *
 * Ela já aparecia no painel de estudo, como um número dentro de um cartão entre
 * outros três. Ganhou tela porque é a única coisa do app que a pessoa abre TODO
 * DIA e por vontade própria — e o que se olha todo dia merece caber inteiro na
 * tela em vez de dividir espaço com o resto.
 *
 * A ordem dos blocos é a de urgência, e não a de importância: a semana vem antes
 * das conquistas porque a pergunta de quem abre é "eu já estudei hoje?", não
 * "quantas medalhas eu tenho".
 */
export default function OfensivaScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(24);
  const { isPro } = useIsPro();
  const cliente = useQueryClient();

  const { data: painel } = useQuery({ queryKey: ['painel'], queryFn: carregarPainel });
  const { data: protetor } = useQuery({
    queryKey: ['protetor', isPro],
    queryFn: () => conferirProtetor(isPro),
  });
  const { data: semana } = useQuery({ queryKey: ['semana'], queryFn: () => semanaAtual() });

  // Gastar um protetor muda a ofensiva. Sem esta linha o número continuaria o
  // de antes até a próxima abertura, e a tela mostraria o aviso de "salvamos
  // sua ofensiva" bem em cima de um zero.
  useEffect(() => {
    if ((protetor?.salvosAgora.length ?? 0) > 0) {
      void cliente.invalidateQueries({ queryKey: ['painel'] });
      void cliente.invalidateQueries({ queryKey: ['semana'] });
    }
  }, [protetor?.salvosAgora.length, cliente]);

  if (!painel) {
    return (
      <Screen>
        <ScreenHeader title="Ofensiva" showMenu={false} onBackPress={() => router.back()} />
      </Screen>
    );
  }

  const { ofensiva } = painel;
  const marcos = marcosDa(Math.max(ofensiva.atual, ofensiva.recorde));
  const proximo = proximoMarco(ofensiva.atual);
  const estudouHoje = !ofensiva.emRisco && ofensiva.atual > 0;

  return (
    <Screen padBottom={false}>
      <ScreenHeader title="Ofensiva" showMenu={false} onBackPress={() => router.back()} />

      <ScrollView className="px-4" contentContainerStyle={{ paddingBottom: bottom }}>
        {/* --- a chama ---------------------------------------------------- */}
        <View className="mt-2 items-center rounded-3xl bg-surface-light py-8 dark:bg-surface-dark">
          {/* Cinza quando a ofensiva está por um fio, laranja quando está viva.
              A cor faz o trabalho que o texto faria mais devagar: dá para saber
              se estudou hoje sem ler nada. */}
          <View
            className="h-24 w-24 items-center justify-center rounded-full"
            style={{ backgroundColor: (estudouHoje ? '#F9AB00' : tokens.muted) + '1F' }}
          >
            <Feather
              name="zap"
              size={44}
              color={estudouHoje ? '#F9AB00' : tokens.muted}
            />
          </View>

          <AppText style={{ fontSize: 52, fontWeight: '800', marginTop: 8 }}>
            {ofensiva.atual}
          </AppText>
          <AppText variant="caption">
            {ofensiva.atual === 1 ? 'dia seguido' : 'dias seguidos'}
          </AppText>

          {ofensiva.emRisco ? (
            <View className="mt-3 flex-row items-center gap-2 rounded-full bg-canvas-light px-3.5 py-2 dark:bg-canvas-dark">
              <Feather name="clock" size={13} color={tokens.danger} />
              <AppText variant="small" className="text-danger">
                Você ainda não estudou hoje.
              </AppText>
            </View>
          ) : null}

          {ofensiva.recorde > ofensiva.atual ? (
            <AppText variant="small" className="mt-2">
              Seu recorde é {ofensiva.recorde}.
            </AppText>
          ) : null}
        </View>

        {/* --- a semana --------------------------------------------------- */}
        <View className="mt-3 rounded-3xl bg-surface-light p-4 dark:bg-surface-dark">
          <View className="flex-row justify-between">
            {(semana ?? []).map((d, i) => (
              <View key={d.dia} className="items-center gap-1.5">
                <AppText variant="small" style={{ opacity: d.ehHoje ? 1 : 0.5 }}>
                  {LETRAS[i]}
                </AppText>
                <View
                  className="h-9 w-9 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: d.estudou
                      ? '#F9AB00'
                      : d.protegido
                        ? tokens.accent + '33'
                        : 'transparent',
                    borderWidth: d.ehHoje && !d.estudou ? 1.5 : 0,
                    borderColor: tokens.accent,
                  }}
                >
                  {d.estudou ? (
                    <Feather name="check" size={17} color="#fff" />
                  ) : d.protegido ? (
                    // Ícone diferente de propósito: o dia foi salvo, não
                    // estudado, e apagar essa diferença tiraria da pessoa a
                    // informação de que ela usou um protetor.
                    <Feather name="shield" size={15} color={tokens.accent} />
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* --- o protetor ------------------------------------------------- */}
        <View className="mt-3 rounded-3xl bg-surface-light p-4 dark:bg-surface-dark">
          <View className="flex-row items-center gap-3">
            <Feather
              name="shield"
              size={20}
              color={(protetor?.disponiveis ?? 0) > 0 ? tokens.accent : tokens.muted}
            />
            <View className="flex-1">
              <AppText variant="body">Protetor de ofensiva</AppText>
              <AppText variant="small">
                {textoDoProtetor(protetor?.disponiveis ?? 0, protetor?.teto ?? 2)}
              </AppText>
            </View>
          </View>

          {(protetor?.salvosAgora.length ?? 0) > 0 ? (
            <View className="mt-3 flex-row items-center gap-2 rounded-2xl bg-canvas-light p-3 dark:bg-canvas-dark">
              <Feather name="shield" size={14} color={tokens.accent} />
              <AppText variant="small" className="flex-1">
                {protetor!.salvosAgora.length === 1
                  ? 'Usamos um protetor: sua ofensiva continua de pé.'
                  : `Usamos ${protetor!.salvosAgora.length} protetores: sua ofensiva continua de pé.`}
              </AppText>
            </View>
          ) : null}

          {!isPro ? (
            <AppText variant="small" className="mt-2">
              No Pro dá para guardar 3 em vez de 2.
            </AppText>
          ) : null}
        </View>

        {/* --- o próximo alvo --------------------------------------------- */}
        {proximo ? (
          <View className="mt-3 rounded-3xl bg-surface-light p-4 dark:bg-surface-dark">
            <View className="mb-2 flex-row items-center justify-between">
              <AppText variant="body">{proximo.marco.nome}</AppText>
              <AppText variant="small">
                {proximo.faltam === 1 ? 'falta 1 dia' : `faltam ${proximo.faltam} dias`}
              </AppText>
            </View>
            <View className="h-2 overflow-hidden rounded-full bg-hairline-light dark:bg-hairline-dark">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${Math.round((ofensiva.atual / proximo.marco.dias) * 100)}%`,
                  backgroundColor: proximo.marco.cor,
                }}
              />
            </View>
          </View>
        ) : null}

        {/* --- as conquistas ---------------------------------------------- */}
        <AppText variant="caption" className="mb-2 mt-5 px-1">
          Conquistas
        </AppText>
        <View className="rounded-3xl bg-surface-light p-4 dark:bg-surface-dark">
          {marcos.map((m, i) => (
            <View
              key={m.dias}
              className={`flex-row items-center gap-3 ${i > 0 ? 'mt-3.5' : ''}`}
              accessibilityLabel={
                m.conquistado
                  ? `${m.nome}, conquistada`
                  : `${m.nome}, faltam ${m.dias} dias seguidos`
              }
            >
              <View
                className="h-11 w-11 items-center justify-center rounded-full"
                style={{
                  backgroundColor: (m.conquistado ? m.cor : tokens.muted) + (m.conquistado ? '26' : '12'),
                  borderWidth: m.conquistado ? 1.5 : 0,
                  borderColor: m.cor,
                }}
              >
                <Feather
                  name={m.icone as keyof typeof Feather.glyphMap}
                  size={18}
                  color={m.conquistado ? m.cor : tokens.muted}
                  style={m.conquistado ? undefined : { opacity: 0.5 }}
                />
              </View>

              <View className="flex-1">
                <AppText variant="body" style={{ opacity: m.conquistado ? 1 : 0.55 }}>
                  {m.nome}
                </AppText>
                {/* A frase de festa só aparece depois de conquistada. Antes,
                    ela estragaria o momento — e "CEM DIAS" escrito ao lado de
                    uma barra em 3% é deboche. */}
                <AppText variant="small">
                  {m.conquistado ? m.festa : `${m.dias} dias seguidos`}
                </AppText>
              </View>
            </View>
          ))}
        </View>

        <AppText variant="small" className="mt-4 px-1 text-center">
          Escrever nota, revisar carta ou gravar aula — qualquer uma das três
          conta o dia. Um protetor a cada {DIAS_POR_PROTETOR} dias estudados.
        </AppText>
      </ScrollView>
    </Screen>
  );
}
