import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { Screen } from '@/components/Screen';
import { Toque } from '@/components/Toque';
import { useSession } from '@/features/auth/hooks/useSession';
import {
  agruparPorDia,
  desconto,
  duracaoDoSaldo,
  emReais,
  gastoPorMotivo,
  iconeDoMotivo,
  nomeDoMotivo,
  precoPorCredito,
} from '@/features/billing/creditos';
import {
  lerExtrato,
  lerSaldo,
  listarPacotes,
} from '@/features/billing/services/credits.service';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Onde o crédito é visto, e para onde ele foi.
 *
 * O saldo já era cobrado antes desta tela existir: a transcrição e o assistente
 * debitavam, e a única forma de descobrir o quanto era ficar sem. Cobrar sem
 * mostrar extrato é o tipo de coisa que faz a pessoa desconfiar do app inteiro,
 * e com razão.
 *
 * A compra ainda não fecha, e isso está escrito na tela em vez de escondido
 * atrás de um botão que não faz nada. A `grant_credits` não aceita chamada do
 * aplicativo de propósito — quem credita é o servidor depois de ouvir a loja —,
 * então prometer compra aqui seria prometer o que nem o banco permite.
 */
export default function CreditsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(24);
  const { user } = useSession();
  const logado = Boolean(user?.id);

  const saldo = useQuery({ queryKey: ['creditos', 'saldo'], queryFn: lerSaldo, enabled: logado });
  const extrato = useQuery({ queryKey: ['creditos', 'extrato'], queryFn: () => lerExtrato(), enabled: logado });
  const pacotes = useQuery({ queryKey: ['creditos', 'pacotes'], queryFn: listarPacotes, enabled: logado });

  const linhas = extrato.data ?? [];
  const gastos = gastoPorMotivo(linhas);
  const grupos = agruparPorDia(linhas);
  const dura = saldo.data ? duracaoDoSaldo(saldo.data.creditos, linhas) : null;
  const menor = (pacotes.data ?? [])[0];

  if (!logado) {
    return (
      <Screen>
        <ScreenHeader title="Créditos" showMenu={false} onBackPress={() => router.back()} />
        <View className="flex-1 items-center justify-center gap-3 px-10">
          <Feather name="lock" size={28} color={tokens.muted} />
          <AppText variant="caption" className="text-center">
            Entre na sua conta para ver o saldo e o extrato.
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padBottom={false}>
      <ScreenHeader title="Créditos" showMenu={false} onBackPress={() => router.back()} />

      <ScrollView className="px-4" contentContainerStyle={{ paddingBottom: bottom }}>
        {/* --- o saldo ---------------------------------------------------- */}
        <View className="mt-2 items-center rounded-3xl bg-surface-light py-7 dark:bg-surface-dark">
          <AppText className="text-[44px] font-bold leading-[52px] text-ink-light dark:text-ink-dark">
            {saldo.data?.creditos ?? '—'}
          </AppText>
          <AppText variant="body" className="mt-1">
            {saldo.data?.creditos === 1 ? 'crédito' : 'créditos'}
          </AppText>

          {/*
            A projeção só aparece quando dá para fazê-la. Com menos de três
            consumos ela seria chute com cara de número, e "dura 3 dias" errado
            é pior que espaço em branco.
          */}
          {dura !== null && dura > 0 ? (
            <AppText variant="small" className="mt-2">
              No seu ritmo, dura mais {dura} {dura === 1 ? 'dia' : 'dias'}
            </AppText>
          ) : saldo.data?.creditos === 0 ? (
            <AppText variant="small" className="mt-2" style={{ color: tokens.danger }}>
              Sem crédito, a transcrição e o assistente ficam parados
            </AppText>
          ) : null}
        </View>

        {/* --- para onde foi --------------------------------------------- */}
        {gastos.length > 0 ? (
          <>
            <AppText variant="caption" className="mb-2 mt-6 px-1">
              Para onde foi
            </AppText>
            <View className="gap-3 rounded-3xl bg-surface-light p-4 dark:bg-surface-dark">
              {gastos.map((g) => (
                <View key={g.motivo}>
                  <View className="mb-1.5 flex-row items-center gap-2">
                    <Feather
                      name={iconeDoMotivo(g.motivo) as keyof typeof Feather.glyphMap}
                      size={14}
                      color={tokens.muted}
                    />
                    <AppText variant="caption" className="flex-1 text-ink-light dark:text-ink-dark">
                      {g.nome}
                    </AppText>
                    <AppText variant="caption">{g.creditos}</AppText>
                  </View>
                  <View className="h-1.5 overflow-hidden rounded-full bg-hairline-light dark:bg-hairline-dark">
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(2, g.fracao * 100)}%`, backgroundColor: tokens.accent }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* --- os pacotes ------------------------------------------------- */}
        {(pacotes.data?.length ?? 0) > 0 ? (
          <>
            <AppText variant="caption" className="mb-2 mt-6 px-1">
              Pacotes
            </AppText>
            <View className="gap-2">
              {pacotes.data?.map((p) => {
                const abate = menor ? desconto(p.centavos, p.creditos, menor.centavos, menor.creditos) : 0;
                return (
                  <Toque
                    key={p.id}
                    onPress={() => router.push('/upgrade-soon')}
                    className="flex-row items-center gap-3 rounded-2xl bg-surface-light px-4 py-3.5 dark:bg-surface-dark"
                    accessibilityRole="button"
                    accessibilityLabel={`${p.nome} por ${emReais(p.centavos)}`}
                  >
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <AppText variant="bodyEmphasis">{p.nome}</AppText>
                        {abate >= 3 ? (
                          <View
                            className="rounded-full px-2 py-0.5"
                            style={{ backgroundColor: tokens.accent + '22' }}
                          >
                            <AppText variant="small" style={{ color: tokens.accent }}>
                              {abate}% off
                            </AppText>
                          </View>
                        ) : null}
                      </View>
                      <AppText variant="small">{precoPorCredito(p.centavos, p.creditos)}</AppText>
                    </View>
                    <AppText variant="bodyEmphasis">{emReais(p.centavos)}</AppText>
                    <Feather name="chevron-right" size={16} color={tokens.muted} />
                  </Toque>
                );
              })}
            </View>

            <AppText variant="small" className="mt-2 px-1">
              A compra ainda não está ligada. Quem credita é o servidor depois de a loja confirmar
              o pagamento, e essa ponte é a parte que falta.
            </AppText>
          </>
        ) : null}

        {/* --- o extrato -------------------------------------------------- */}
        <AppText variant="caption" className="mb-2 mt-6 px-1">
          Extrato
        </AppText>

        {linhas.length === 0 ? (
          <View className="items-center rounded-3xl bg-surface-light py-8 dark:bg-surface-dark">
            <Feather name="file-text" size={24} color={tokens.muted} />
            <AppText variant="caption" className="mt-3 px-8 text-center">
              Nada ainda. Cada uso do assistente e cada minuto transcrito aparece aqui, com data e
              motivo.
            </AppText>
          </View>
        ) : (
          <View className="overflow-hidden rounded-3xl bg-surface-light dark:bg-surface-dark">
            {grupos.map((grupo, gi) => (
              <View key={grupo.titulo}>
                <AppText variant="small" className="px-4 pb-1 pt-3 uppercase">
                  {grupo.titulo}
                </AppText>
                {grupo.linhas.map((linha, li) => (
                  <View key={linha.id}>
                    <View className="flex-row items-center gap-3 px-4 py-3">
                      <Feather
                        name={iconeDoMotivo(linha.motivo) as keyof typeof Feather.glyphMap}
                        size={16}
                        color={tokens.muted}
                      />
                      <AppText variant="body" className="flex-1">
                        {nomeDoMotivo(linha.motivo)}
                      </AppText>
                      <AppText
                        variant="bodyEmphasis"
                        style={{ color: linha.delta > 0 ? '#1E8E3E' : tokens.ink }}
                      >
                        {linha.delta > 0 ? `+${linha.delta}` : linha.delta}
                      </AppText>
                    </View>
                    {li < grupo.linhas.length - 1 ? <Divider className="ml-11" /> : null}
                  </View>
                ))}
                {gi < grupos.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
